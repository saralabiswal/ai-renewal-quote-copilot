import Link from 'next/link'
import { PageHeader } from '@/components/layout/page-header'
import { WorkflowJourney } from '@/components/layout/workflow-journey'
import { ActionRail } from '@/components/layout/action-rail'
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
        title={isListView ? 'Renewal Subscriptions' : 'Case Decision Board'}
        description={
          isListView
            ? 'Baseline subscription data grouped by account.'
            : 'Review renewal cases at decision stage by storyline lane before quote execution. Focus on recommendation, risk, ARR direction, and approval posture.'
        }
        purpose={
          isListView
            ? 'Inspect renewal subscription baseline before running AI workflow decisions.'
            : 'Prioritize renewal cases and choose where to start decision workflow execution.'
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
                  Open Case Decision Board
                </Link>
              }
              secondary={
                <Link className="button-secondary" href="/scenario-quotes">
                  Open Scenario Quotes
                </Link>
              }
              tertiary={
                <Link className="button-tertiary" href="/quote-drafts">
                  Open Quote Draft Board
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
                  Open Scenario Quotes
                </Link>
              }
              tertiary={
                <Link className="button-tertiary" href="/quote-drafts">
                  Open Quote Draft Board
                </Link>
              }
            />
          )
        }
      />

      <WorkflowJourney
        title="Renewal Flow Progress"
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
            label: 'Case Decision Board',
            description: 'Prioritize case-level recommendation and risk decisions.',
            href: '/renewal-cases',
            state: isListView ? 'upcoming' : 'current',
          },
          {
            id: 'scenario-workspace',
            label: 'Scenario Quotes',
            description: 'Compare commercial alternatives against baseline quote.',
            href: '/scenario-quotes',
            state: 'upcoming',
          },
          {
            id: 'quote-review',
            label: 'Quote Draft Board',
            description: 'Approve or reject the final baseline quote draft.',
            href: '/quote-drafts',
            state: 'upcoming',
          },
        ]}
      />

      <section className="card">
        <div className="section-header">
          <div>
            <h2 className="section-title">{isListView ? 'Subscriptions by Account' : 'Case Decision Storyboard'}</h2>
            <p className="section-subtitle">
              {isListView
                ? 'Collapsed by default. Expand an account to view subscription lines.'
                : 'Cases are grouped by business storyline with source labeling that separates subscription baseline from AI decision outputs.'}
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
