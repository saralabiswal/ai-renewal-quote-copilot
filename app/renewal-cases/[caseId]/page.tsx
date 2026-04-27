import Link from 'next/link'
import { notFound } from 'next/navigation'
import { RenewalCaseSummaryCards } from '@/components/renewal-cases/renewal-case-summary-cards'
import { RecalculateButton } from '@/components/renewal-cases/recalculate-button'
import { GenerateAiButton } from '@/components/renewal-cases/generate-ai-button'
import { QuoteInsightsPanel } from '@/components/renewal-cases/quote-insights-panel'
import { RenewalCaseReviewWorkspace } from '@/components/renewal-cases/review-workspace'
import { getRenewalCaseById } from '@/lib/db/renewal-cases'
import { getQuoteInsightsByRenewalCaseId } from '@/lib/db/quote-insights'
import { Badge } from '@/components/ui/badge'
import { DemoScenarioSelector } from '@/components/renewal-cases/demo-scenario-selector'
import { WhatChangedSummary } from '@/components/renewal-cases/what-changed-summary'
import { RegenerateInsightsAiButton } from '@/components/renewal-cases/regenerate-insights-ai-button'
import { AiWorkflowRunner } from '@/components/renewal-cases/ai-workflow-runner'
import { WorkflowJourney } from '@/components/layout/workflow-journey'
import { ActionRail } from '@/components/layout/action-rail'
import { DecisionRunTracePanel } from '@/components/renewal-cases/decision-run-trace-panel'

export default async function RenewalCaseDetailPage({
  params,
}: {
  params: Promise<{ caseId: string }>
}) {
  const { caseId } = await params

  const [renewalCase, quoteInsights] = await Promise.all([
    getRenewalCaseById(caseId),
    getQuoteInsightsByRenewalCaseId(caseId),
  ])

  if (!renewalCase) {
    notFound()
  }

  const quoteStatusKey = renewalCase.quoteDraft?.status.toLowerCase() ?? ''
  const hasQuoteDraft = Boolean(renewalCase.quoteDraft)
  const quoteDecisionComplete = quoteStatusKey === 'approved' || quoteStatusKey === 'rejected'
  const casePurpose =
    'Run the end-to-end renewal workflow and decide which quote actions should feed the baseline quote.'
  const caseNextStep = quoteInsights.needsRefresh
    ? 'In Section A, click Regenerate Insights + AI Rationale, then apply refreshed actions in Section C.'
    : 'Apply top quote insights in Section C, then open Scenario Studio for comparison.'

  return (
    <div className="page">
      <section className="card renewal-workspace-hero">
        <div className="renewal-workspace-main">
          <div className="renewal-workspace-title-row">
            <div>
              <h1 className="renewal-workspace-title">Renewal Command Center</h1>
              <p className="renewal-workspace-subtitle">
                Compare subscription baseline with ML-assisted outputs, refresh quote insights, and
                move the right commercial actions forward with clear traceability.
              </p>
              <div className="page-header-guidance" style={{ marginTop: 10 }}>
                <p className="page-header-purpose">
                  <strong>Purpose:</strong> {casePurpose}
                </p>
                <p className="page-header-next">
                  <strong>Next:</strong> {caseNextStep}
                </p>
              </div>
            </div>

            <div className="renewal-header-badges">
              <Badge tone={renewalCase.riskTone}>{renewalCase.riskLevel}</Badge>
              <Badge tone={renewalCase.actionTone}>{renewalCase.recommendedActionLabel}</Badge>
            </div>
          </div>

          <div className="renewal-context-grid">
            <div className="renewal-context-item">
              <div className="small muted">Case</div>
              <div className="renewal-context-value">{renewalCase.caseNumber}</div>
            </div>
            <div className="renewal-context-item">
              <div className="small muted">Account</div>
              <div className="renewal-context-value">{renewalCase.account.name}</div>
            </div>
            <div className="renewal-context-item">
              <div className="small muted">Window</div>
              <div className="renewal-context-value">{renewalCase.windowLabel}</div>
            </div>
          </div>
        </div>

        <div className="renewal-header-actions">
          <div className="renewal-action-panel">
            <div className="renewal-action-panel-head">
              <div className="small muted" style={{ fontWeight: 700 }}>
                Command Actions
              </div>
              <div className="small muted">
                Approval Required: {renewalCase.recalculationMeta.approvalRequired ? 'Yes' : 'No'}
              </div>
            </div>

            {renewalCase.quoteDraft ? (
              <div className="renewal-quote-link-row">
                <div>
                  <div className="small muted" style={{ fontWeight: 600 }}>
                    Linked Quote
                  </div>
                  <div className="small muted">
                    {renewalCase.quoteDraft.quoteNumber} · {renewalCase.quoteDraft.totalNetAmountFormatted}
                  </div>
                </div>
                <Link className="button-link" href={`/quote-drafts/${renewalCase.quoteDraft.id}`}>
                  Open Baseline Quote
                </Link>
              </div>
            ) : (
              <div className="small muted">
                No baseline quote draft linked yet. Apply quote insights in Section C to create one.
              </div>
            )}

            <div className="small muted">
              Final approve, reject, and revision actions are completed in Quote Review Center.
            </div>
          </div>
        </div>
      </section>

      <WorkflowJourney
        title="Renewal Workflow"
        subtitle="Use this path to move from renewal decisioning to a final quote outcome."
        steps={[
          {
            id: 'subscriptions',
            label: 'Renewal Subscriptions',
            description: 'Baseline subscription and entitlement context reviewed.',
            href: '/renewal-cases?view=list',
            state: 'complete',
          },
          {
            id: 'decision-workspace',
            label: 'Renewal Command Center',
            description: 'Run recommendation, regenerate insights, and review AI guidance.',
            href: `/renewal-cases/${renewalCase.id}`,
            state: 'current',
          },
          {
            id: 'scenario-workspace',
            label: 'Scenario Studio',
            description: hasQuoteDraft
              ? 'Compare alternative scenario quotes against baseline.'
              : 'Link or generate a baseline quote to enable scenario comparison.',
            href: `/scenario-quotes/${renewalCase.id}`,
            state: 'upcoming',
          },
          {
            id: 'quote-review',
            label: 'Quote Review Center',
            description: hasQuoteDraft
              ? quoteDecisionComplete
                ? 'Final quote decision has been submitted.'
                : 'Open the linked quote and complete approval review.'
              : 'Quote review is available after a baseline quote is linked.',
            href: hasQuoteDraft ? `/quote-drafts/${renewalCase.quoteDraft?.id}` : undefined,
            state: quoteDecisionComplete ? 'complete' : 'upcoming',
          },
        ]}
      />

      <RenewalCaseSummaryCards summary={renewalCase.summaryCards} />
      <section className="card case-workflow-section">
        <div className="case-workflow-header">
          <div className="case-workflow-kicker">Section A</div>
          <h3 className="panel-title">Run Renewal Workflow</h3>
          <p className="section-subtitle">
            Select scenario, then run the workflow. AI Live is the primary path for end-to-end
            execution. Manual controls are available for step-by-step walkthroughs.
          </p>
        </div>

        <div className="case-workflow-mode-note">
          <strong>Primary path:</strong> Run <strong>AI Live</strong> first for fastest updates.
          Use manual controls only when you need to demonstrate each mutation independently.
        </div>

        <AiWorkflowRunner
          caseId={renewalCase.id}
          selectedScenarioKey={renewalCase.demoScenarioKey ?? 'BASE_CASE'}
        />

        <details className="manual-workflow-shell case-manual-secondary">
          <summary className="manual-workflow-summary">Manual Workflow Actions (Optional)</summary>
          <div className="manual-workflow-content">
            <div className="manual-workflow-content-inner">
              <p className="manual-workflow-subtitle">
                Use these controls to run one mutation at a time when you want detailed walkthrough
                pacing.
              </p>

              <div className="manual-scenario-shell">
                <div className="small muted" style={{ fontWeight: 700 }}>
                  Scenario Selection
                </div>
                <div className="small muted">
                  Scenario selection is shared across AI Live and Manual actions. Choose it in either
                  panel.
                </div>
                <DemoScenarioSelector
                  caseId={renewalCase.id}
                  selectedScenarioKey={renewalCase.demoScenarioKey ?? 'BASE_CASE'}
                  embedded
                />
              </div>

              <div className="manual-workflow-grid" style={{ marginTop: 10 }}>
                <div className="manual-workflow-step-card">
                  <div className="small muted" style={{ marginBottom: 4 }}>
                    Step 1
                  </div>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Recommendation</div>
                  <p className="workflow-mutation-helper">
                    Updates risk, action, and approval posture. Marks quote insights as stale.
                  </p>
                  <RecalculateButton
                    caseId={renewalCase.id}
                    label="Regenerate Recommendation"
                    loadingLabel="Regenerating Recommendation..."
                    buttonClassName="button-link"
                  />
                </div>

                <div className="manual-workflow-step-card">
                  <div className="small muted" style={{ marginBottom: 4 }}>
                    Step 2
                  </div>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Insights + AI</div>
                  <p className="workflow-mutation-helper">
                    Regenerates quote insights and AI rationale so quote actions match latest recommendation.
                  </p>
                  <RegenerateInsightsAiButton
                    caseId={renewalCase.id}
                    label="Regenerate Insights + AI Rationale"
                    loadingLabel="Regenerating Insights + AI Rationale..."
                    buttonClassName="button-link"
                  />
                </div>

                <div className="manual-workflow-step-card">
                  <div className="small muted" style={{ marginBottom: 4 }}>
                    Step 3
                  </div>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Full AI Guidance (Optional)</div>
                  <p className="workflow-mutation-helper">
                    Generates executive summary, reviewer rationale, and approval brief when required.
                  </p>
                  <GenerateAiButton
                    caseId={renewalCase.id}
                    label="Generate Full AI Review Guidance"
                    loadingLabel="Generating Full AI Review Guidance..."
                    buttonClassName="button-secondary"
                  />
                </div>
              </div>
            </div>
          </div>
        </details>
      </section>

      <section className="card case-workflow-section">
        <div className="case-workflow-header">
          <div className="case-workflow-kicker">Section B</div>
          <h3 className="panel-title">What Changed</h3>
          <p className="section-subtitle">
            Review recommendation and quote-insight deltas from the latest workflow run before
            applying actions.
          </p>
        </div>

        <WhatChangedSummary
          recommendation={renewalCase.whatChanged?.recommendation ?? null}
          insights={renewalCase.whatChanged?.insights ?? null}
          embedded
        />
      </section>

      <section className="card case-workflow-section">
        <div className="case-workflow-header">
          <div className="case-workflow-kicker">Section C</div>
          <h3 className="panel-title">Quote Insights (Apply Actions)</h3>
          <p className="section-subtitle">
            Apply selected quote insights to the baseline quote. Use Scenario Studio first if you
            need alternate commercial comparisons.
          </p>
        </div>

        <ActionRail
          primary={
            <Link className="button-link" href={`/scenario-quotes/${renewalCase.id}`}>
              Open Scenario Studio
            </Link>
          }
          secondary={
            renewalCase.quoteDraft ? (
              <Link className="button-secondary" href={`/quote-drafts/${renewalCase.quoteDraft.id}`}>
              Open Baseline Quote
              </Link>
            ) : undefined
          }
          tertiary={
            <Link className="button-tertiary" href="/quote-drafts">
              Open Quote Review Center
            </Link>
          }
          hint="Scenario comparison is read-only. Baseline Quote remains the editable source."
        />
      </section>

      <QuoteInsightsPanel
        caseId={quoteInsights.caseId}
        accountName={renewalCase.account.name}
        items={quoteInsights.items}
        currencyCode={quoteInsights.currencyCode}
        needsRefresh={quoteInsights.needsRefresh}
        generatedAtLabel={quoteInsights.generatedAtLabel}
      />

      <section className="card case-workflow-section">
        <div className="case-workflow-header">
          <div className="case-workflow-kicker">Section D</div>
          <h3 className="panel-title">Review Intelligence</h3>
          <p className="section-subtitle">
            Validate bundle analysis, review AI guidance, and inspect decision history before final
            quote approval.
          </p>
        </div>
      </section>

      <DecisionRunTracePanel run={renewalCase.latestDecisionRun} />

      <RenewalCaseReviewWorkspace
        analysis={renewalCase.analysis}
        items={renewalCase.items}
        reviewHistory={renewalCase.reviewHistory}
        aiExecutiveSummary={renewalCase.aiExecutiveSummary}
        aiApprovalBrief={renewalCase.aiApprovalBrief}
        narrative={renewalCase.narrative}
        recalculationMeta={renewalCase.recalculationMeta}
      />
    </div>
  )
}
