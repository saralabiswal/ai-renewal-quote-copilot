import Link from 'next/link'
import { PageHeader } from '@/components/layout/page-header'
import { WorkflowJourney } from '@/components/layout/workflow-journey'
import { ActionRail } from '@/components/layout/action-rail'
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
      <PageHeader
        title={isListView ? 'Renewal Subscriptions' : 'Renewal Command Center'}
        description={
          isListView
            ? 'Baseline subscription data grouped by account.'
            : 'Prioritize renewal opportunities with ML-assisted risk, commercial posture, ARR direction, and approval signals.'
        }
        purpose={
          isListView
            ? 'Inspect renewal subscription baseline before running AI workflow decisions.'
            : 'Choose where to start the renewal decision workflow and keep the commercial path moving.'
        }
        nextStep={
          isListView
            ? 'Expand an account row to review subscription lines.'
            : 'Open a case with high risk or approval required first.'
        }
        actions={
          isListView ? (
            <ActionRail
              primary={
                <Link className="button-link" href="/renewal-cases">
                  Open Renewal Command Center
                </Link>
              }
              secondary={
                <Link className="button-secondary" href="/scenario-quotes">
                  Open Scenario Studio
                </Link>
              }
              tertiary={
                <Link className="button-tertiary" href="/quote-drafts">
                  Open Quote Review Center
                </Link>
              }
            />
          ) : (
            <ActionRail
              primary={
                <Link className="button-link" href="/renewal-cases?view=list">
                  Open Renewal Subscriptions
                </Link>
              }
              secondary={
                <Link className="button-secondary" href="/scenario-quotes">
                  Open Scenario Studio
                </Link>
              }
              tertiary={
                <Link className="button-tertiary" href="/quote-drafts">
                  Open Quote Review Center
                </Link>
              }
            />
          )
        }
      />

      <WorkflowJourney
        title="Renewal Workflow"
        subtitle="Use this as the default operating sequence for live demos and self-guided users."
        steps={[
          {
            id: 'subscriptions',
            label: 'Renewal Subscriptions',
            description: 'Review baseline subscription lines and account context.',
            href: '/renewal-cases?view=list',
            state: isListView ? 'current' : 'complete',
          },
          {
            id: 'decision-board',
            label: 'Renewal Command Center',
            description: 'Prioritize case-level recommendation and risk decisions.',
            href: '/renewal-cases',
            state: isListView ? 'upcoming' : 'current',
          },
          {
            id: 'scenario-workspace',
            label: 'Scenario Studio',
            description: 'Compare commercial alternatives against baseline quote.',
            href: '/scenario-quotes',
            state: 'upcoming',
          },
          {
            id: 'quote-review',
            label: 'Quote Review Center',
            description: 'Approve or reject the final baseline quote draft.',
            href: '/quote-drafts',
            state: 'upcoming',
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
                : 'Cases are grouped by commercial storyline with clear separation between subscription baseline, ML-assisted recommendation, and quote execution outputs.'}
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
