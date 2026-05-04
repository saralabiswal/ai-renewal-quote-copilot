import Link from 'next/link'
import { notFound } from 'next/navigation'
import { QuoteScenariosPanel } from '@/components/renewal-cases/quote-scenarios-panel'
import { ScenarioStrategyCoachPanel } from '@/components/renewal-cases/scenario-strategy-coach-panel'
import { WorkflowJourney } from '@/components/layout/workflow-journey'
import { ActionRail } from '@/components/layout/action-rail'
import { buildScenarioPersonalizationView } from '@/lib/ai/scenario-personalization'
import {
  generateQuoteScenariosForRenewalCase,
  getQuoteScenarioWorkspaceByRenewalCaseId,
} from '@/lib/db/quote-scenarios'
import { getRenewalCaseById } from '@/lib/db/renewal-cases'

export default async function ScenarioQuoteWorkspacePage({
  params,
}: {
  params: Promise<{ caseId: string }>
}) {
  const { caseId } = await params
  const renewalCase = await getRenewalCaseById(caseId)

  if (!renewalCase) {
    notFound()
  }

  let quoteScenarioWorkspace = await getQuoteScenarioWorkspaceByRenewalCaseId(caseId)
  const shouldAutoGenerateScenarios =
    Boolean(quoteScenarioWorkspace.baselineQuote) &&
    (quoteScenarioWorkspace.needsRefresh ||
      (quoteScenarioWorkspace.scenarios.length === 0 &&
        !quoteScenarioWorkspace.lastRunSummary?.generatedAt))

  if (shouldAutoGenerateScenarios) {
    try {
      await generateQuoteScenariosForRenewalCase(caseId)
      quoteScenarioWorkspace = await getQuoteScenarioWorkspaceByRenewalCaseId(caseId)
    } catch (error) {
      console.error('Auto-generation of quote scenarios failed', error)
    }
  }

  const coach = buildScenarioPersonalizationView(renewalCase, quoteScenarioWorkspace)
  const hasQuoteDraft = Boolean(renewalCase.quoteDraft)
  const hasScenarioQuotes = quoteScenarioWorkspace.scenarios.length > 0
  const scenarioPurpose =
    'Review read-only scenario quotes against the editable baseline quote before final approval.'
  const scenarioNextStep = !quoteScenarioWorkspace.baselineQuote
    ? 'Open Baseline Quote Review first. Use Scenario Quote Generation Trace only when the generation path needs explanation.'
    : hasScenarioQuotes
      ? 'Select a scenario in the navigator, review deltas, then mark your preferred scenario.'
      : quoteScenarioWorkspace.lastRunSummary?.suppressedReason
        ? `Scenarios were auto-generated but suppressed: ${quoteScenarioWorkspace.lastRunSummary.suppressedReason}`
        : 'Scenarios auto-generate on page load once baseline quote and insights are ready.'

  return (
    <div className="page">
      <section className="card">
        <div className="section-header">
          <div>
            <h1 className="renewal-workspace-title">Scenario Quote Review</h1>
            <p className="section-subtitle">
              Case {renewalCase.caseNumber} · {renewalCase.account.name} · {renewalCase.windowLabel}
            </p>
            <div className="page-header-guidance" style={{ marginTop: 10 }}>
              <p className="page-header-purpose">
                <strong>Purpose:</strong> {scenarioPurpose}
              </p>
              <p className="page-header-next">
                <strong>Next:</strong> {scenarioNextStep}
              </p>
            </div>
          </div>

          <ActionRail
            primary={
              <Link className="button-link" href={`/renewal-cases/${renewalCase.id}`}>
                Open Generation Trace
              </Link>
            }
            secondary={
              hasQuoteDraft ? (
                <Link className="button-secondary" href={`/quote-drafts/${renewalCase.quoteDraft!.id}`}>
                  Open Baseline Quote Draft
                </Link>
              ) : undefined
            }
            tertiary={
              <Link className="button-tertiary" href="/scenario-quotes">
                Back to Scenario Quote Review
              </Link>
            }
          />
        </div>
      </section>

      <WorkflowJourney
        title="Business Review Flow"
        subtitle="Review subscription scope, baseline quote, and scenario quote before using optional generation trace."
        steps={[
          {
            id: 'subscriptions',
            label: 'Review Renewal Subscriptions',
            description: 'Baseline subscription scope already established.',
            href: '/renewal-cases?view=list',
            state: 'complete',
          },
          {
            id: 'baseline-quote',
            label: 'Review Baseline Quote',
            description: hasQuoteDraft
              ? 'Editable baseline quote is linked for this renewal.'
              : 'Baseline quote must be linked before scenario quote review.',
            href: hasQuoteDraft ? `/quote-drafts/${renewalCase.quoteDraft?.id}` : '/quote-drafts',
            state: hasQuoteDraft ? 'complete' : 'upcoming',
          },
          {
            id: 'scenario-workspace',
            label: 'Review Scenario Quote',
            description: 'Compare alternatives and mark a preferred scenario.',
            href: `/scenario-quotes/${renewalCase.id}`,
            state: 'current',
          },
          {
            id: 'decision-workspace',
            label: 'Scenario Quote Generation Trace',
            description: 'Optional explanation console for how scenario quote evidence was generated.',
            href: `/renewal-cases/${renewalCase.id}`,
            state: 'upcoming',
          },
        ]}
      />

      <ScenarioStrategyCoachPanel coach={coach} workspace={quoteScenarioWorkspace} />
      <QuoteScenariosPanel caseId={renewalCase.id} workspace={quoteScenarioWorkspace} />
    </div>
  )
}
