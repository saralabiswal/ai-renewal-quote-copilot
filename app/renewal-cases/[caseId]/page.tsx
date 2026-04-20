import Link from 'next/link'
import { notFound } from 'next/navigation'
import { RenewalCaseSummaryCards } from '@/components/renewal-cases/renewal-case-summary-cards'
import { RecalculateButton } from '@/components/renewal-cases/recalculate-button'
import { GenerateAiButton } from '@/components/renewal-cases/generate-ai-button'
import { ReviewActions } from '@/components/renewal-cases/review-actions'
import { QuoteInsightsPanel } from '@/components/renewal-cases/quote-insights-panel'
import { RenewalCaseReviewWorkspace } from '@/components/renewal-cases/review-workspace'
import { getRenewalCaseById } from '@/lib/db/renewal-cases'
import { getQuoteInsightsByRenewalCaseId } from '@/lib/db/quote-insights'
import { Badge } from '@/components/ui/badge'
import { DemoScenarioSelector } from '@/components/renewal-cases/demo-scenario-selector'
import { WhatChangedSummary } from '@/components/renewal-cases/what-changed-summary'
import { RegenerateInsightsAiButton } from '@/components/renewal-cases/regenerate-insights-ai-button'
import { AiWorkflowRunner } from '@/components/renewal-cases/ai-workflow-runner'

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

  return (
    <div className="page">
      <section className="card renewal-workspace-hero">
        <div className="renewal-workspace-main">
          <div className="renewal-workspace-title-row">
            <div>
              <h1 className="renewal-workspace-title">Renewal Quote Decision Workspace</h1>
              <p className="renewal-workspace-subtitle">
                Compare subscription baseline with AI outputs, regenerate insights, and apply the
                right quote actions with clear traceability.
              </p>
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
                Case Actions
              </div>
              <div className="small muted">
                Approval Required: {renewalCase.recalculationMeta.approvalRequired ? 'Yes' : 'No'}
              </div>
            </div>

            {renewalCase.quoteDraft ? (
              <div className="renewal-quote-link-row">
                <div>
                  <div className="small muted" style={{ fontWeight: 600 }}>
                    Linked Renewal Quote
                  </div>
                  <div className="small muted">
                    {renewalCase.quoteDraft.quoteNumber} · {renewalCase.quoteDraft.totalNetAmountFormatted}
                  </div>
                </div>
                <Link className="button-link" href={`/quote-drafts/${renewalCase.quoteDraft.id}`}>
                  View Renewal Quote
                </Link>
              </div>
            ) : (
              <div className="small muted">No quote draft linked yet.</div>
            )}

            {renewalCase.quoteDraft ? (
              <ReviewActions quoteDraftId={renewalCase.quoteDraft.id} align="left" />
            ) : (
              <div className="small muted">
                Quote review actions appear after a renewal quote is linked.
              </div>
            )}
          </div>
        </div>
      </section>

      <RenewalCaseSummaryCards summary={renewalCase.summaryCards} />
      <div className="card">
        <div className="section-header" style={{ marginBottom: 12 }}>
          <div>
            <h3 className="panel-title">Regeneration Quote Workflow</h3>
            <p className="section-subtitle">
              Set scenario, regenerate recommendation and insights, generate AI review guidance,
              then review what changed.
            </p>
          </div>
        </div>

        <div className="workflow-guide-strip">
          <div className="small muted" style={{ fontWeight: 700 }}>
            How to Use This Workflow
          </div>
          <div className="workflow-guide-row">
            <div className="workflow-guide-item">
              <span>1</span>
              <p>Choose scenario.</p>
            </div>
            <div className="workflow-guide-item">
              <span>2</span>
              <p>Regenerate recommendation and insights.</p>
            </div>
            <div className="workflow-guide-item">
              <span>3</span>
              <p>Review What Changed, then apply quote actions.</p>
            </div>
          </div>
        </div>

        <AiWorkflowRunner
          caseId={renewalCase.id}
          selectedScenarioKey={renewalCase.demoScenarioKey ?? 'BASE_CASE'}
        />

        <details className="manual-workflow-shell">
          <summary className="manual-workflow-summary">Manual Workflow Actions</summary>

          <p className="manual-workflow-subtitle">
            Use manual controls to run each step one by one during walkthroughs.
          </p>

          <div className="manual-scenario-shell">
            <div className="small muted" style={{ fontWeight: 700 }}>
              Scenario Selection
            </div>
            <div className="small muted">
              Scenario choice applies to the manual step-by-step workflow.
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
              <div style={{ fontWeight: 600, marginBottom: 10 }}>Recommendation</div>
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
              <div style={{ fontWeight: 600, marginBottom: 10 }}>Insights + AI</div>
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
              <div style={{ fontWeight: 600, marginBottom: 10 }}>Full AI Guidance (Optional)</div>
              <GenerateAiButton
                caseId={renewalCase.id}
                label="Generate Full AI Review Guidance"
                loadingLabel="Generating Full AI Review Guidance..."
                buttonClassName="button-secondary"
              />
            </div>
          </div>
        </details>

        <WhatChangedSummary
          recommendation={renewalCase.whatChanged?.recommendation ?? null}
          insights={renewalCase.whatChanged?.insights ?? null}
          embedded
        />
      </div>

      <QuoteInsightsPanel
        caseId={quoteInsights.caseId}
        items={quoteInsights.items}
        currencyCode={quoteInsights.currencyCode}
        needsRefresh={quoteInsights.needsRefresh}
        generatedAtLabel={quoteInsights.generatedAtLabel}
      />

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
