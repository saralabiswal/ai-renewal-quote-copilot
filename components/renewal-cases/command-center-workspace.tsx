'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { ActionRail } from '@/components/layout/action-rail'
import { WorkflowJourney } from '@/components/layout/workflow-journey'
import { AiWorkflowRunner } from '@/components/renewal-cases/ai-workflow-runner'
import { DecisionRunTracePanel } from '@/components/renewal-cases/decision-run-trace-panel'
import { DemoScenarioSelector } from '@/components/renewal-cases/demo-scenario-selector'
import { GenerateAiButton } from '@/components/renewal-cases/generate-ai-button'
import { QuoteInsightsPanel } from '@/components/renewal-cases/quote-insights-panel'
import { RecalculateButton } from '@/components/renewal-cases/recalculate-button'
import { RegenerateInsightsAiButton } from '@/components/renewal-cases/regenerate-insights-ai-button'
import { RenewalCaseReviewWorkspace } from '@/components/renewal-cases/review-workspace'
import { WhatChangedSummary } from '@/components/renewal-cases/what-changed-summary'
import { FormattedAiText } from '@/components/ui/formatted-ai-text'
import type { QuoteInsightView } from '@/lib/db/quote-insights'
import type { RenewalCaseDetailView } from '@/types/renewal-case'

type CommandTab = 'run' | 'changes' | 'quote-actions' | 'evidence' | 'review'

type QuoteInsightsWorkspaceData = {
  caseId: string
  currencyCode: string
  needsRefresh: boolean
  generatedAtLabel: string | null
  items: QuoteInsightView[]
}

const TABS: Array<{
  id: CommandTab
  step: number
  label: string
  helper: string
  next: string
}> = [
  {
    id: 'run',
    step: 1,
    label: 'Run Workflow',
    helper: 'Scenario and AI workflow',
    next: 'Choose a scenario and run the end-to-end AI workflow.',
  },
  {
    id: 'changes',
    step: 2,
    label: 'Review Changes',
    helper: 'What changed after run',
    next: 'Confirm the recommendation and quote-insight deltas before applying actions.',
  },
  {
    id: 'quote-actions',
    step: 3,
    label: 'Apply Quote Actions',
    helper: 'Apply quote insights',
    next: 'Apply selected quote insights to the editable baseline quote.',
  },
  {
    id: 'evidence',
    step: 4,
    label: 'Decision Trace',
    helper: 'Evidence, rules, ML, guardrails',
    next: 'Use this checkpoint to inspect evidence snapshots, rules, ML output, guardrails, and governance trace.',
  },
  {
    id: 'review',
    step: 5,
    label: 'Finalize Review',
    helper: 'Analysis and guidance',
    next: 'Review AI guidance and move to Quote Review Center for final approval.',
  },
]

export function CommandCenterWorkspace({
  renewalCase,
  quoteInsights,
}: {
  renewalCase: RenewalCaseDetailView
  quoteInsights: QuoteInsightsWorkspaceData
}) {
  const [activeTab, setActiveTab] = useState<CommandTab>('run')
  const quoteStatusKey = renewalCase.quoteDraft?.status.toLowerCase() ?? ''
  const hasQuoteDraft = Boolean(renewalCase.quoteDraft)
  const quoteDecisionComplete = quoteStatusKey === 'approved' || quoteStatusKey === 'rejected'

  const quoteInsightCount = quoteInsights.items.length
  const suggestedInsightCount = quoteInsights.items.filter(
    (item) => !item.isAddedToQuote,
  ).length
  const addedInsightCount = quoteInsights.items.filter((item) => item.isAddedToQuote).length
  const activeStep = TABS.find((tab) => tab.id === activeTab) ?? TABS[0]
  const stepStatus = (tab: CommandTab) => {
    switch (tab) {
      case 'run':
        return renewalCase.latestDecisionRun ? 'Complete' : 'Ready'
      case 'changes':
        return renewalCase.latestDecisionRun ? 'Review' : 'Waiting'
      case 'quote-actions':
        if (quoteInsights.needsRefresh) return 'Needs Refresh'
        if (suggestedInsightCount > 0) return 'Ready'
        return addedInsightCount > 0 ? 'Complete' : 'Waiting'
      case 'evidence':
        return renewalCase.latestDecisionRun ? 'Optional' : 'Waiting'
      case 'review':
        return quoteDecisionComplete ? 'Complete' : 'Final'
    }
  }

  return (
    <section className="command-workspace">
      <div className="command-sticky-bar">
        <div className="command-flow-head">
          <div>
            <div className="command-flow-title">Guided Renewal Flow</div>
            <div className="command-flow-next">
              <strong>Next:</strong> {activeStep.next}
            </div>
          </div>
          <div className="command-flow-progress">
            Step {activeStep.step} of {TABS.length}
          </div>
        </div>

        <div className="command-tabbar" role="tablist" aria-label="Guided renewal flow">
          {TABS.map((tab) => (
            <button
              type="button"
              key={tab.id}
              className={`command-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              aria-pressed={activeTab === tab.id}
            >
              <span className="command-step-number">{tab.step}</span>
              <span className="command-step-copy">
                <span className="command-step-title">{tab.label}</span>
                <small>{tab.helper}</small>
              </span>
              <span className={`command-step-status ${statusTone(stepStatus(tab.id))}`}>
                {activeTab === tab.id ? 'Current' : stepStatus(tab.id)}
              </span>
            </button>
          ))}
        </div>

        <div className="command-mini-status" aria-label="Current case status">
          <span>{renewalCase.recommendedActionLabel}</span>
          <span>{renewalCase.riskLevel} risk</span>
          <span>{renewalCase.recalculationMeta.approvalRequired ? 'Approval required' : 'No approval'}</span>
          <span>{quoteInsightCount} insights</span>
        </div>
      </div>

      {activeTab === 'run' ? (
        <div className="command-tab-panel">
          <section className="card command-section-card">
            <div className="command-section-head">
              <div>
                <h2 className="section-title">Run Renewal Workflow</h2>
                <p className="section-subtitle">
                  Choose a scenario and run the end-to-end workflow. Advanced prompts and manual
                  mutation controls stay available without dominating the page.
                </p>
              </div>
              <div className="command-stat-strip">
                <MetricPill label="Scenario" value={formatScenario(renewalCase.demoScenarioKey)} />
                <MetricPill
                  label="Approval"
                  value={renewalCase.recalculationMeta.approvalRequired ? 'Required' : 'Not Required'}
                />
                <MetricPill label="Quote" value={renewalCase.quoteDraft?.quoteNumber ?? 'Not Linked'} />
              </div>
            </div>

            <AiWorkflowRunner
              caseId={renewalCase.id}
              selectedScenarioKey={renewalCase.demoScenarioKey ?? 'BASE_CASE'}
            />

            <details className="manual-workflow-shell case-manual-secondary">
              <summary className="manual-workflow-summary">
                Advanced Manual Workflow Actions
              </summary>
              <div className="manual-workflow-content">
                <div className="manual-workflow-content-inner">
                  <p className="manual-workflow-subtitle">
                    Run one mutation at a time only when you want detailed walkthrough pacing.
                  </p>

                  <div className="manual-scenario-shell">
                    <div className="small muted" style={{ fontWeight: 700 }}>
                      Scenario Selection
                    </div>
                    <div className="small muted">
                      Scenario selection is shared across AI Live and Manual actions.
                    </div>
                    <DemoScenarioSelector
                      caseId={renewalCase.id}
                      selectedScenarioKey={renewalCase.demoScenarioKey ?? 'BASE_CASE'}
                      embedded
                    />
                  </div>

                  <div className="manual-workflow-grid" style={{ marginTop: 10 }}>
                    <ManualStep
                      step="Step 1"
                      title="Recommendation"
                      helper="Updates risk, action, and approval posture. Marks quote insights as stale."
                    >
                      <RecalculateButton
                        caseId={renewalCase.id}
                        label="Regenerate Recommendation"
                        loadingLabel="Regenerating Recommendation..."
                        buttonClassName="button-link"
                      />
                    </ManualStep>

                    <ManualStep
                      step="Step 2"
                      title="Insights + AI"
                      helper="Regenerates quote insights and AI rationale so quote actions match latest recommendation."
                    >
                      <RegenerateInsightsAiButton
                        caseId={renewalCase.id}
                        label="Regenerate Insights + AI Rationale"
                        loadingLabel="Regenerating Insights + AI Rationale..."
                        buttonClassName="button-link"
                      />
                    </ManualStep>

                    <ManualStep
                      step="Step 3"
                      title="Full AI Guidance"
                      helper="Generates executive summary, reviewer rationale, reasoning, and approval brief when required."
                    >
                      <GenerateAiButton
                        caseId={renewalCase.id}
                        label="Generate Full AI Review Guidance"
                        loadingLabel="Generating Full AI Review Guidance..."
                        buttonClassName="button-secondary"
                      />
                    </ManualStep>
                  </div>
                </div>
              </div>
            </details>
          </section>
        </div>
      ) : null}

      {activeTab === 'changes' ? (
        <div className="command-tab-panel">
          <section className="card command-section-card">
            <div className="command-section-head">
              <div>
                <h2 className="section-title">What Changed</h2>
                <p className="section-subtitle">
                  Fast read of recommendation and quote-insight deltas from the latest workflow run.
                </p>
              </div>
              <div className="command-stat-strip">
                <MetricPill label="Scenario" value={formatScenario(renewalCase.demoScenarioKey)} />
                <MetricPill label="Suggested" value={String(suggestedInsightCount)} />
                <MetricPill label="Added" value={String(addedInsightCount)} />
              </div>
            </div>
          </section>

          <WhatChangedSummary
            recommendation={renewalCase.whatChanged?.recommendation ?? null}
            insights={renewalCase.whatChanged?.insights ?? null}
            embedded
          />

          <section className="card command-reasoning-preview">
            <div className="command-reasoning-title">What Changed Reasoning</div>
            <div className="guidance-section-content">
              {renewalCase.reasoningWhatChanged?.content ? (
                <FormattedAiText text={renewalCase.reasoningWhatChanged.content} />
              ) : (
                <span className="muted">
                  Run Full AI Review Guidance to generate evidence-backed change reasoning.
                </span>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === 'quote-actions' ? (
        <div className="command-tab-panel">
          <section className="card command-section-card">
            <div className="command-section-head">
              <div>
                <h2 className="section-title">Quote Actions</h2>
                <p className="section-subtitle">
                  Apply selected quote insights to the editable baseline quote. Detailed evidence is
                  inside each insight drawer.
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
                    <Link
                      className="button-secondary"
                      href={`/quote-drafts/${renewalCase.quoteDraft.id}`}
                    >
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
            </div>
          </section>

          <QuoteInsightsPanel
            caseId={quoteInsights.caseId}
            accountName={renewalCase.account.name}
            items={quoteInsights.items}
            currencyCode={quoteInsights.currencyCode}
            needsRefresh={quoteInsights.needsRefresh}
            generatedAtLabel={quoteInsights.generatedAtLabel}
          />
        </div>
      ) : null}

      {activeTab === 'evidence' ? (
        <div className="command-tab-panel">
          <section className="card command-section-card">
            <div className="command-section-head">
              <div>
                <h2 className="section-title">Decision Evidence</h2>
                <p className="section-subtitle">
                  Technical audit view for rules, ML, final output, guardrails, and reasoning.
                </p>
              </div>
            </div>
          </section>

          <DecisionRunTracePanel
            caseId={renewalCase.id}
            run={renewalCase.latestDecisionRun}
            reasoning={renewalCase.reasoningDecisionTrace}
          />
        </div>
      ) : null}

      {activeTab === 'review' ? (
        <div className="command-tab-panel">
          <section className="card command-section-card">
            <div className="command-section-head">
              <div>
                <h2 className="section-title">Review</h2>
                <p className="section-subtitle">
                  Bundle analysis, line details, AI guidance, approval brief, and review history.
                </p>
              </div>
            </div>
          </section>

          <RenewalCaseReviewWorkspace
            analysis={renewalCase.analysis}
            items={renewalCase.items}
            reviewHistory={renewalCase.reviewHistory}
            aiExecutiveSummary={renewalCase.aiExecutiveSummary}
            aiApprovalBrief={renewalCase.aiApprovalBrief}
            narrative={renewalCase.narrative}
            reasoningRecommendation={renewalCase.reasoningRecommendation}
            reasoningApproval={renewalCase.reasoningApproval}
            reasoningWhatChanged={renewalCase.reasoningWhatChanged}
            recalculationMeta={renewalCase.recalculationMeta}
            layout="guidance-first"
          />
        </div>
      ) : null}

      <details className="command-secondary-flow">
        <summary>Workflow Path</summary>
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
      </details>
    </section>
  )
}

function statusTone(status: string) {
  if (status === 'Complete') return 'complete'
  if (status === 'Waiting') return 'waiting'
  if (status === 'Needs Refresh') return 'refresh'
  if (status === 'Ready') return 'ready'
  if (status === 'Review') return 'review'
  if (status === 'Final') return 'final'
  return 'optional'
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="command-metric-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function ManualStep({
  step,
  title,
  helper,
  children,
}: {
  step: string
  title: string
  helper: string
  children: ReactNode
}) {
  return (
    <div className="manual-workflow-step-card">
      <div className="small muted" style={{ marginBottom: 4 }}>
        {step}
      </div>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>{title}</div>
      <p className="workflow-mutation-helper">{helper}</p>
      {children}
    </div>
  )
}

function formatScenario(value: string | null | undefined) {
  if (!value) return 'Base Case'
  return value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
