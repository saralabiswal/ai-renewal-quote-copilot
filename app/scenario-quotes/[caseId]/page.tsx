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
  const quoteStatusKey = renewalCase.quoteDraft?.status.toLowerCase() ?? ''
  const hasQuoteDraft = Boolean(renewalCase.quoteDraft)
  const quoteDecisionComplete = quoteStatusKey === 'approved' || quoteStatusKey === 'rejected'
  const hasScenarioQuotes = quoteScenarioWorkspace.scenarios.length > 0
  const scenarioPurpose =
    'Compare read-only scenario quotes against the editable baseline quote before final approval.'
  const scenarioNextStep = !quoteScenarioWorkspace.baselineQuote
    ? 'Open Renewal Command Center and apply quote insights to create a baseline quote first.'
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
            <h1 className="renewal-workspace-title">Scenario Studio</h1>
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
                Open Renewal Command Center
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
                Back to Scenario Studio
              </Link>
            }
          />
        </div>
      </section>

      <WorkflowJourney
        title="Renewal Workflow"
        subtitle="Scenario selection should feed directly into final quote review."
        steps={[
          {
            id: 'subscriptions',
            label: 'Renewal Subscriptions',
            description: 'Baseline subscription scope already established.',
            href: '/renewal-cases?view=list',
            state: 'complete',
          },
          {
            id: 'decision-workspace',
            label: 'Renewal Command Center',
            description: 'Recommendation and insight workflow already completed for this case.',
            href: `/renewal-cases/${renewalCase.id}`,
            state: 'complete',
          },
          {
            id: 'scenario-workspace',
            label: 'Scenario Studio',
            description: 'Compare alternatives and mark a preferred scenario.',
            href: `/scenario-quotes/${renewalCase.id}`,
            state: 'current',
          },
          {
            id: 'quote-review',
            label: 'Quote Review Center',
            description: hasQuoteDraft
              ? quoteDecisionComplete
                ? 'Final quote decision has already been submitted.'
                : 'Open the baseline quote and submit final approval decision.'
              : 'Quote review unlocks after a baseline quote is linked.',
            href: hasQuoteDraft ? `/quote-drafts/${renewalCase.quoteDraft?.id}` : undefined,
            state: quoteDecisionComplete ? 'complete' : 'upcoming',
          },
        ]}
      />

      <ScenarioStrategyCoachPanel coach={coach} workspace={quoteScenarioWorkspace} />
      <QuoteScenariosPanel caseId={renewalCase.id} workspace={quoteScenarioWorkspace} />
    </div>
  )
}
