'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import type { PolicyStudioSeedProfile, PricingPolicyView } from '@/lib/db/policies'
import type { MlRecommendationMode } from '@/lib/ml/config'
import {
  getPromptGovernanceCatalog,
  getPromptStageMeta,
  promptGovernanceSources,
  type PromptStageId,
} from '@/lib/policies/prompt-governance'
import type { RuleFlowStep, RulebookSection } from '@/lib/policies/rule-reference'
import type {
  WorkedExampleProductId,
  WorkedExampleView,
} from '@/lib/policies/worked-example'

type TabId = 'recommendation' | 'insight' | 'example' | 'journey' | 'prompts'
const PROMPT_STAGES: PromptStageId[] = ['recalculate', 'insights_ai', 'full_ai']

function mlModeLabel(mode: MlRecommendationMode) {
  switch (mode) {
    case 'ML_SHADOW':
      return 'Shadow Mode'
    case 'HYBRID_RULES_ML':
      return 'ML-Assisted Rules'
    case 'RULES_ONLY':
    default:
      return 'Rules Only'
  }
}

function mlModeTone(mode: MlRecommendationMode): 'default' | 'info' | 'success' {
  if (mode === 'HYBRID_RULES_ML') return 'success'
  if (mode === 'ML_SHADOW') return 'info'
  return 'default'
}

function recommendationModeCopy(mode: MlRecommendationMode) {
  if (mode === 'HYBRID_RULES_ML') {
    return 'Rules run first, ML risk is blended into the recommendation score, then pricing guardrails remain final.'
  }
  if (mode === 'ML_SHADOW') {
    return 'Rules produce the final recommendation while ML scores are logged for comparison and audit.'
  }
  return 'Only deterministic rules produce recommendation, risk, pricing posture, and approval state.'
}

function insightModeCopy(mode: MlRecommendationMode) {
  if (mode === 'HYBRID_RULES_ML') {
    return 'Quote insights use the ML-assisted recommendation context and show ML risk or expansion evidence when present.'
  }
  if (mode === 'ML_SHADOW') {
    return 'Quote insights remain rule-driven, but can surface shadow ML risk, expansion score, and top features as evidence.'
  }
  return 'Quote insights map directly from deterministic recommendation outputs without ML evidence.'
}

function formatPercent(value: number | null) {
  if (value === null) return '—'
  return `${value.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
    maximumFractionDigits: 1,
  })}%`
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

function countRows(sections: RulebookSection[]) {
  return sections.reduce((sum, section) => sum + section.rows.length, 0)
}

function formatSignedCurrency(value: number) {
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${formatCurrency(value)}`
}

function formatSignedNumber(value: number) {
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
    maximumFractionDigits: 1,
  })}`
}

function formatSignedPercent(value: number) {
  return `${formatSignedNumber(value)}%`
}

function getRiskTone(level: WorkedExampleView['scoring']['finalRiskLevel']) {
  if (level === 'LOW') return 'success'
  if (level === 'MEDIUM') return 'warn'
  return 'danger'
}

function getDispositionTone(disposition: WorkedExampleView['recommendation']['disposition']) {
  if (disposition === 'EXPAND') return 'info'
  if (disposition === 'ESCALATE') return 'danger'
  if (disposition === 'RENEW_WITH_CONCESSION') return 'warn'
  return 'default'
}

function toBusinessSignalLabel(example: WorkedExampleView) {
  switch (example.recommendation.disposition) {
    case 'EXPAND':
      return 'Growth-ready'
    case 'RENEW_WITH_CONCESSION':
      return 'Retention watch'
    case 'ESCALATE':
      return 'Critical risk'
    case 'RENEW':
    default:
      return 'Stable renewal'
  }
}

function toBusinessMoveLabel(example: WorkedExampleView) {
  switch (example.recommendation.disposition) {
    case 'EXPAND':
      return 'Expand at renewal'
    case 'RENEW_WITH_CONCESSION':
      return 'Targeted concession'
    case 'ESCALATE':
      return 'Escalate for deal review'
    case 'RENEW':
    default:
      return 'Renew as-is'
  }
}

function buildBusinessInterpretation(example: WorkedExampleView) {
  const usage = example.inputs.usagePercentOfEntitlement
  const activeUsers = example.inputs.activeUserPercent
  const loginTrend = example.inputs.loginTrend30d
  const trendDirectionLabel =
    example.signalTrend.trendDirection === 'IMPROVING'
      ? 'improving'
      : example.signalTrend.trendDirection === 'DETERIORATING'
        ? 'deteriorating'
        : 'mixed'
  const riskLabel = example.scoring.finalRiskLevel.toLowerCase()
  const signalLabel = toBusinessSignalLabel(example)
  const moveLabel = toBusinessMoveLabel(example)
  const arrDeltaLabel = formatSignedCurrency(example.recommendation.arrDelta)
  const usageStory =
    usage >= 85
      ? `Adoption is strong (${formatPercent(usage)} usage, ${formatPercent(activeUsers)} active users), so this product is being used broadly.`
      : usage >= 55
        ? `Adoption is mixed (${formatPercent(usage)} usage, ${formatPercent(activeUsers)} active users), so growth potential exists but needs focus.`
        : `Adoption is weak (${formatPercent(usage)} usage, ${formatPercent(activeUsers)} active users), which raises renewal risk.`
  const loginStory =
    loginTrend >= 8
      ? `Engagement trend is improving (${formatPercent(loginTrend)} over 30 days).`
      : loginTrend <= -10
        ? `Engagement trend is declining (${formatPercent(loginTrend)} over 30 days).`
        : `Engagement trend is relatively steady (${formatPercent(loginTrend)} over 30 days).`

  const trajectoryStory = `Across ${example.sourceContext.snapshotWindowLabel}, usage moved ${formatSignedPercent(example.signalTrend.usageDelta)}, active users moved ${formatSignedPercent(example.signalTrend.activeUserDelta)}, and CSAT moved ${formatSignedNumber(example.signalTrend.csatDelta)} (${trendDirectionLabel} trajectory).`

  const recommendationStory =
    example.recommendation.disposition === 'EXPAND'
      ? 'The recommendation is to increase quantity with disciplined pricing because current adoption supports expansion.'
      : example.recommendation.disposition === 'RENEW_WITH_CONCESSION'
        ? 'The recommendation is to protect renewal with a controlled concession rather than broad discounting.'
        : example.recommendation.disposition === 'ESCALATE'
          ? 'The recommendation is to route this line to leadership/deal-desk review before finalizing commercial terms.'
          : 'The recommendation is to keep current commercial terms because risk is manageable and signals are stable.'

  const approvalStory = example.guardrails.approvalRequired
    ? 'Policy check outcome: manager/deal approval is required before this can be finalized.'
    : 'Policy check outcome: this stays within standard policy thresholds and can proceed without extra approval.'

  const talkTrack = [
    `Source context: ${example.sourceContext.accountName} / ${example.sourceContext.subscriptionNumber}.`,
    `Business signal: ${signalLabel}.`,
    `Recommended move: ${moveLabel}.`,
    `Signal trajectory over ${example.sourceContext.snapshotWindowLabel}: ${trendDirectionLabel}.`,
    `Commercial impact in this scenario: ${arrDeltaLabel} ARR.`,
    approvalStory,
  ]

  return {
    headline: `${example.product.name}: ${signalLabel}`,
    statusLine: `Overall risk is ${riskLabel}. Suggested motion is ${moveLabel.toLowerCase()}.`,
    situation: `${usageStory} ${loginStory} ${trajectoryStory}`,
    recommendation: recommendationStory,
    impact: `If applied, the projected ARR change is ${arrDeltaLabel} (from ${formatCurrency(example.inputs.currentArr)} to ${formatCurrency(example.recommendation.proposedArr)}).`,
    approval: approvalStory,
    talkTrack,
  }
}

function RuleSectionAccordion({
  sections,
}: {
  sections: RulebookSection[]
}) {
  return (
    <div className="policy-accordion">
      {sections.map((section, index) => (
        <details key={section.title} className="policy-details" open={index === 0}>
          <summary>
            <span>{section.title}</span>
            <span className="small muted">{section.rows.length} rules</span>
          </summary>
          <p className="section-subtitle" style={{ marginTop: 8 }}>
            {section.description}
          </p>
          <div className="policy-rule-rows">
            {section.rows.map((row) => (
              <div key={`${section.title}-${row.trigger}`} className="policy-rule-row">
                <div>
                  <div className="small muted">Trigger</div>
                  <div>{row.trigger}</div>
                </div>
                <div>
                  <div className="small muted">Effect</div>
                  <div>{row.effect}</div>
                </div>
                <div>
                  <div className="small muted">Notes</div>
                  <div>{row.notes ?? '—'}</div>
                </div>
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  )
}

function RuleFlowMap({
  title,
  subtitle,
  steps,
}: {
  title: string
  subtitle: string
  steps: RuleFlowStep[]
}) {
  return (
    <section className="policy-flow-map" aria-label={title}>
      <div className="policy-flow-head">
        <h3 className="panel-title">{title}</h3>
        <p className="section-subtitle">{subtitle}</p>
      </div>
      <ol className="policy-flow-list">
        {steps.map((step) => (
          <li key={step.id} className="policy-flow-step">
            <div className="policy-flow-step-head">
              <span className="policy-flow-id">{step.id}</span>
              <h4>{step.title}</h4>
            </div>
            <p>{step.detail}</p>
            <div className="policy-flow-outcome">
              <span className="small muted">Outcome</span>
              <strong>{step.outcome}</strong>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

function ExplainableDecisionDiagram({ example }: { example: WorkedExampleView }) {
  return (
    <section className="policy-explainability-diagram" aria-label="Explainable renewal decision flow">
      <div className="policy-explainability-head">
        <div>
          <h3 className="panel-title">Explainable Renewal Decision Flow</h3>
          <p className="section-subtitle">
            Recommendation rules determine risk, action, and approval posture. Quote insight rules
            turn those outputs into suggested quote actions and read-only scenario quote options.
          </p>
        </div>
        <Badge tone="info">Policy Studio Diagram</Badge>
      </div>

      <div className="policy-engine-diagram-grid">
        <article className="policy-engine-diagram-card">
          <div className="policy-engine-diagram-card-head">
            <div>
              <h4>Recommendation Engine</h4>
              <p>Calculates case posture from subscription signals and policy rules.</p>
            </div>
            <span className="policy-chip">Rules + optional ML</span>
          </div>
          <div className="policy-engine-stage-list">
            <EngineStage
              id="1"
              title="Read case signals"
              detail="Usage, active users, login trend, support burden, Sev1 incidents, CSAT, payment risk, adoption band, product family, and pricing policy."
            />
            <EngineStage
              id="2"
              title="Score each renewal line"
              detail="Rule risk score is computed per subscription line. In ML-assisted mode, model risk is blended with rule risk."
            />
            <EngineStage
              id="3"
              title="Assign line disposition"
              detail="Line becomes renew, expand, renew with concession, or escalate based on risk thresholds, usage capacity, and severe incidents."
            />
            <EngineStage
              id="4"
              title="Roll up bundle action"
              detail="Escalation beats concession, concession beats expansion, and expansion beats renew-as-is. Pricing guardrails decide approval."
              chips={['recommendedAction', 'riskLevel', 'requiresApproval']}
            />
          </div>
        </article>

        <article className="policy-engine-diagram-card">
          <div className="policy-engine-diagram-card-head">
            <div>
              <h4>Quote Insight Engine</h4>
              <p>Translates decision output into quote actions reviewers can inspect.</p>
            </div>
            <span className="policy-chip">Actionable evidence</span>
          </div>
          <div className="policy-engine-stage-list">
            <EngineStage
              id="5"
              title="Map disposition to insight type"
              detail="Expand becomes expansion, concession becomes concession, margin signals become margin recovery, and fallback becomes renew-as-is."
            />
            <EngineStage
              id="6"
              title="Add strategic opportunities"
              detail="Eligible accounts can receive additive cross-sell, data modernization, or hybrid deployment suggestions."
            />
            <EngineStage
              id="7"
              title="Score and explain"
              detail="Each insight gets confidence, fit, ARR impact, structured evidence, reason codes, and optional narrative rationale."
            />
            <EngineStage
              id="8"
              title="Create quote actions and scenarios"
              detail="Insights can be applied to the editable baseline quote or grouped into read-only scenario quote alternatives."
              chips={['quoteInsights', 'quoteActions', 'scenarioQuotes']}
            />
          </div>
        </article>
      </div>

      <div className="policy-evidence-rail">
        <EvidenceTile
          title="Guardrails Stay Final"
          detail="Discount thresholds, floor price checks, and Sev1 escalation rules decide approval posture before quote review."
          tone="policy"
        />
        <EvidenceTile
          title="ML Is Evidence"
          detail="ML can influence risk in assisted mode, but deterministic thresholds and guardrails still shape actions."
          tone="ml"
        />
        <EvidenceTile
          title="Traceable Outputs"
          detail="Rule output, ML output, final output, drivers, reason codes, and quote deltas remain visible for inspection."
          tone="trace"
        />
        <EvidenceTile
          title="Human Approval"
          detail="Reviewers approve, reject, or inspect evidence before final quote execution. Scenario quotes remain read-only."
          tone="human"
        />
      </div>

      <div className="policy-runner-flow">
        <div className="policy-runner-flow-head">
          <h4>Example Runner Flow</h4>
          <p>
            Current example: {example.sourceContext.accountName} / {example.product.name}
          </p>
        </div>
        <div className="policy-runner-flow-track">
          <RunnerNode
            label="Signals"
            value={`${formatPercent(example.inputs.usagePercentOfEntitlement)} usage`}
            detail={`${example.inputs.ticketCount90d} tickets, CSAT ${example.inputs.csatScore.toFixed(1)}`}
          />
          <RunnerNode
            label="Risk"
            value={`${example.scoring.finalRiskLevel} ${example.scoring.finalRiskScore}`}
            detail={example.scoring.topContributors[0]?.signal ?? 'Rule score computed'}
          />
          <RunnerNode
            label="Recommendation"
            value={example.recommendation.disposition}
            detail={`ARR impact ${formatSignedCurrency(example.recommendation.arrDelta)}`}
          />
          <RunnerNode
            label="Guardrail"
            value={example.guardrails.finalGuardrailResult}
            detail={example.guardrails.approvalRequired ? 'Approval required' : 'Within policy'}
          />
          <RunnerNode
            label="Quote Insight"
            value={example.quoteInsight.insightType}
            detail={`Confidence ${example.quoteInsight.confidenceScore}, fit ${example.quoteInsight.fitScore}`}
          />
        </div>
      </div>
    </section>
  )
}

function EngineStage({
  id,
  title,
  detail,
  chips = [],
}: {
  id: string
  title: string
  detail: string
  chips?: string[]
}) {
  return (
    <div className="policy-engine-stage">
      <span className="policy-engine-stage-id">{id}</span>
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
        {chips.length > 0 ? (
          <div className="policy-chip-wrap">
            {chips.map((chip) => (
              <span key={chip} className="policy-chip">
                {chip}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function EvidenceTile({
  title,
  detail,
  tone,
}: {
  title: string
  detail: string
  tone: 'policy' | 'ml' | 'trace' | 'human'
}) {
  return (
    <article className={`policy-evidence-tile ${tone}`}>
      <h4>{title}</h4>
      <p>{detail}</p>
    </article>
  )
}

function RunnerNode({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <article className="policy-runner-node">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  )
}

function EngineSticker({
  label,
  tone = 'rules',
}: {
  label: string
  tone?: 'data' | 'rules' | 'guardrail' | 'insight' | 'review'
}) {
  return <span className={`policy-engine-sticker ${tone}`}>{label}</span>
}

function StepMarker({
  step,
  engineLabel,
  tone,
}: {
  step: string
  engineLabel: string
  tone: 'data' | 'rules' | 'guardrail' | 'insight' | 'review'
}) {
  return (
    <span className="policy-step-marker">
      <span className="policy-step-number">{step}</span>
      <EngineSticker label={engineLabel} tone={tone} />
    </span>
  )
}

export function PoliciesWorkspace({
  mlMode,
  mlEnabled,
  mlAffectsRecommendations,
  mlModelName,
  mlModelVersion,
  pricingPolicies,
  recommendationSections,
  recommendationSources,
  recommendationFlowSteps,
  insightSections,
  insightSources,
  insightFlowSteps,
  workedExamples,
  workedExampleOptions,
  seedProfile,
}: {
  mlMode: MlRecommendationMode
  mlEnabled: boolean
  mlAffectsRecommendations: boolean
  mlModelName: string | null
  mlModelVersion: string | null
  pricingPolicies: PricingPolicyView[]
  recommendationSections: RulebookSection[]
  recommendationSources: readonly string[]
  recommendationFlowSteps: RuleFlowStep[]
  insightSections: RulebookSection[]
  insightSources: readonly string[]
  insightFlowSteps: RuleFlowStep[]
  workedExamples: Record<WorkedExampleProductId, WorkedExampleView>
  workedExampleOptions: Array<{
    id: WorkedExampleProductId
    label: string
  }>
  seedProfile: PolicyStudioSeedProfile
}) {
  const [activeTab, setActiveTab] = useState<TabId>('example')
  const [selectedProductId, setSelectedProductId] = useState<WorkedExampleProductId>(
    workedExampleOptions[0]?.id ?? 'fusion_apps',
  )
  const promptCatalog = useMemo(() => getPromptGovernanceCatalog(), [])
  const promptArtifactsByStage = useMemo(
    () =>
      PROMPT_STAGES.map((stage) => ({
        stage,
        stageMeta: getPromptStageMeta(stage),
        artifacts: promptCatalog.filter((artifact) => artifact.stage === stage),
      })),
    [promptCatalog],
  )

  const fallbackWorkedExample = workedExamples[workedExampleOptions[0]?.id ?? 'fusion_apps']
  const workedExample =
    workedExamples[selectedProductId] ?? fallbackWorkedExample ?? Object.values(workedExamples)[0]
  const businessInterpretation = workedExample
    ? buildBusinessInterpretation(workedExample)
    : null
  const workedExampleBusinessRows = workedExampleOptions
    .map((option) => {
      const example = workedExamples[option.id]
      if (!example) return null

      return {
        id: option.id,
        label: option.label,
        signalLabel: toBusinessSignalLabel(example),
        moveLabel: toBusinessMoveLabel(example),
        arrDelta: formatSignedCurrency(example.recommendation.arrDelta),
        approvalLabel: example.guardrails.approvalRequired
          ? 'Approval required'
          : 'Within policy',
      }
    })
    .filter(Boolean) as Array<{
    id: WorkedExampleProductId
    label: string
    signalLabel: string
    moveLabel: string
    arrDelta: string
    approvalLabel: string
  }>

  const summary = useMemo(
    () => ({
      activePolicies: pricingPolicies.filter((item) => item.isActive).length,
      recommendationRules: countRows(recommendationSections),
      insightRules: countRows(insightSections),
      promptArtifacts: promptCatalog.length,
    }),
    [pricingPolicies, recommendationSections, insightSections, promptCatalog.length],
  )

  if (!workedExample || !businessInterpretation) return null

  return (
    <section className="card policy-workspace-shell">
      <div className="policy-workspace-head">
        <div>
          <h2 className="section-title">Policy Intelligence Studio</h2>
          <p className="section-subtitle">
            Switch tabs to inspect rule logic and a full worked product example without long page
            scrolling.
          </p>
        </div>
        <div className="policy-stats-ribbon">
          <div className="policy-stat">
            <div className="small muted">Active Policies</div>
            <div className="policy-stat-value">{summary.activePolicies}</div>
          </div>
          <div className="policy-stat">
            <div className="small muted">Recommendation Rules</div>
            <div className="policy-stat-value">{summary.recommendationRules}</div>
          </div>
          <div className="policy-stat">
            <div className="small muted">Insight Rules</div>
            <div className="policy-stat-value">{summary.insightRules}</div>
          </div>
          <div className="policy-stat">
            <div className="small muted">Prompt Packs</div>
            <div className="policy-stat-value">{summary.promptArtifacts}</div>
          </div>
        </div>
      </div>

      <section className="policy-mode-banner">
        <div>
          <div className="small muted">Recommendation Mode</div>
          <div className="policy-mode-title">
            <Badge tone={mlModeTone(mlMode)}>{mlModeLabel(mlMode)}</Badge>
            <span>{mlModelName ?? 'No ML model registered'}</span>
          </div>
          <p>
            {mlMode === 'RULES_ONLY'
              ? 'Policy Studio is showing the deterministic rulebook that currently controls both recommendation and quote insight generation.'
              : 'Policy Studio is showing the deterministic rulebook plus how the selected ML mode participates in recommendation and quote insight evidence.'}
          </p>
        </div>
        <div className="policy-mode-impact-grid">
          <div className="policy-mode-impact-card">
            <div className="small muted">Recommendation UI</div>
            <strong>{mlAffectsRecommendations ? 'ML-assisted' : 'Rule-authoritative'}</strong>
            <p>{recommendationModeCopy(mlMode)}</p>
          </div>
          <div className="policy-mode-impact-card">
            <div className="small muted">Quote Insight UI</div>
            <strong>{mlEnabled ? 'ML evidence available' : 'Rule-only evidence'}</strong>
            <p>{insightModeCopy(mlMode)}</p>
          </div>
        </div>
      </section>

      <div className="policy-tabbar" role="tablist" aria-label="Policies tabs">
        <button
          type="button"
          className={`policy-tab ${activeTab === 'example' ? 'active' : ''}`}
          onClick={() => setActiveTab('example')}
          aria-pressed={activeTab === 'example'}
        >
          Worked Product Example
        </button>
        <button
          type="button"
          className={`policy-tab ${activeTab === 'journey' ? 'active' : ''}`}
          onClick={() => setActiveTab('journey')}
          aria-pressed={activeTab === 'journey'}
        >
          End-to-End Visual Flow
        </button>
        <button
          type="button"
          className={`policy-tab ${activeTab === 'recommendation' ? 'active' : ''}`}
          onClick={() => setActiveTab('recommendation')}
          aria-pressed={activeTab === 'recommendation'}
        >
          Quote Recommendation Rules
        </button>
        <button
          type="button"
          className={`policy-tab ${activeTab === 'insight' ? 'active' : ''}`}
          onClick={() => setActiveTab('insight')}
          aria-pressed={activeTab === 'insight'}
        >
          Quote Insight Rules
        </button>
        <button
          type="button"
          className={`policy-tab ${activeTab === 'prompts' ? 'active' : ''}`}
          onClick={() => setActiveTab('prompts')}
          aria-pressed={activeTab === 'prompts'}
        >
          Prompt Governance
        </button>
      </div>

      {activeTab === 'recommendation' ? (
        <div className="policy-tab-layout">
          <div className="policy-tab-main">
            <RuleFlowMap
              title="Recommendation Engine Flow"
              subtitle="Mind-map sequence showing how subscription signals convert into a final recommendation."
              steps={recommendationFlowSteps}
            />
            <RuleSectionAccordion sections={recommendationSections} />
          </div>

          <aside className="policy-tab-side">
            <div className="policy-side-card">
              <div className="small muted" style={{ fontWeight: 700, marginBottom: 8 }}>
                Current Mode Impact
              </div>
              <div className="policy-chip-wrap" style={{ marginBottom: 10 }}>
                <Badge tone={mlModeTone(mlMode)}>{mlModeLabel(mlMode)}</Badge>
                <Badge tone={mlAffectsRecommendations ? 'success' : 'default'}>
                  {mlAffectsRecommendations ? 'Affects Score' : 'Audit Only'}
                </Badge>
              </div>
              <div className="small muted" style={{ lineHeight: 1.5 }}>
                {recommendationModeCopy(mlMode)}
              </div>
              {mlModelName ? (
                <div className="small muted" style={{ marginTop: 8 }}>
                  Model: {mlModelName} {mlModelVersion ?? ''}
                </div>
              ) : null}
            </div>

            <div className="policy-side-card">
              <div className="small muted" style={{ fontWeight: 700, marginBottom: 8 }}>
                Rule Sources
              </div>
              <div className="policy-source-list">
                {recommendationSources.map((source) => (
                  <code key={source}>{source}</code>
                ))}
              </div>
            </div>

            <div className="policy-side-card">
              <div className="small muted" style={{ fontWeight: 700, marginBottom: 8 }}>
                Pricing Guardrail Thresholds
              </div>
              <div className="policy-threshold-grid">
                {pricingPolicies.filter((policy) => policy.isActive).map((policy) => (
                  <article key={policy.id} className="policy-threshold-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontWeight: 700 }}>{policy.name}</div>
                      <Badge tone="success">Active</Badge>
                    </div>
                    <div className="small muted" style={{ marginTop: 4 }}>
                      {policy.accountSegmentLabel} · {policy.productFamilyLabel}
                    </div>
                    <div className="policy-threshold-kv">
                      <span>Max Auto Discount</span>
                      <strong>{formatPercent(policy.maxAutoDiscountPercent)}</strong>
                    </div>
                    <div className="policy-threshold-kv">
                      <span>Approval Discount</span>
                      <strong>{formatPercent(policy.approvalDiscountPercent)}</strong>
                    </div>
                    <div className="policy-threshold-kv">
                      <span>Floor Price (% List)</span>
                      <strong>{formatPercent(policy.floorPricePercentOfList)}</strong>
                    </div>
                    <div className="policy-threshold-kv">
                      <span>Expansion Threshold</span>
                      <strong>{formatPercent(policy.expansionThresholdUsagePercent)}</strong>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {activeTab === 'insight' ? (
        <div className="policy-tab-layout">
          <div className="policy-tab-main">
            <RuleFlowMap
              title="Quote Insight Flow"
              subtitle="Mind-map sequence showing how recommendation outputs become actionable quote insights."
              steps={insightFlowSteps}
            />
            <RuleSectionAccordion sections={insightSections} />
          </div>

          <aside className="policy-tab-side">
            <div className="policy-side-card">
              <div className="small muted" style={{ fontWeight: 700, marginBottom: 8 }}>
                Current Mode Impact
              </div>
              <div className="policy-chip-wrap" style={{ marginBottom: 10 }}>
                <Badge tone={mlModeTone(mlMode)}>{mlModeLabel(mlMode)}</Badge>
                <Badge tone={mlEnabled ? 'info' : 'default'}>
                  {mlEnabled ? 'ML Evidence' : 'Rules Only'}
                </Badge>
              </div>
              <div className="small muted" style={{ lineHeight: 1.5 }}>
                {insightModeCopy(mlMode)}
              </div>
            </div>

            <div className="policy-side-card">
              <div className="small muted" style={{ fontWeight: 700, marginBottom: 8 }}>
                Rule Sources
              </div>
              <div className="policy-source-list">
                {insightSources.map((source) => (
                  <code key={source}>{source}</code>
                ))}
              </div>
            </div>

            <div className="policy-side-card">
              <div className="small muted" style={{ fontWeight: 700, marginBottom: 8 }}>
                Mapping Quick View
              </div>
              <p className="small muted" style={{ marginTop: 0, marginBottom: 10, lineHeight: 1.45 }}>
                Recommendation outputs on the left are translated into quote insight types on the
                right, which then drive suggested quote actions and scenario quotes.
              </p>
              <div className="policy-chip-wrap">
                <span className="policy-chip">EXPAND -&gt; EXPANSION</span>
                <span className="policy-chip">PRICE_ADJUST -&gt; MARGIN_RECOVERY</span>
                <span className="policy-chip">RENEW_WITH_CONCESSION -&gt; CONCESSION</span>
                <span className="policy-chip">ESCALATE -&gt; DEFENSIVE_RENEWAL</span>
                <span className="policy-chip">UPLIFT -&gt; CONTROLLED_UPLIFT</span>
                <span className="policy-chip">Fallback -&gt; RENEW_AS_IS</span>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {activeTab === 'prompts' ? (
        <div className="policy-tab-layout">
          <div className="policy-tab-main">
            <section className="policy-prompt-overview">
              <div>
                <h3 className="panel-title" style={{ marginBottom: 6 }}>
                  Current LLM Prompts
                </h3>
                <p className="section-subtitle" style={{ marginTop: 0 }}>
                  Exact current prompt text used by each AI workflow stage.
                </p>
              </div>
            </section>

            {promptArtifactsByStage.map(({ stage, stageMeta, artifacts }) => (
              <section key={stage} className="policy-prompt-stage">
                <div className="policy-prompt-stage-head">
                  <h4>{stageMeta.label}</h4>
                  <p>{stageMeta.subtitle}</p>
                </div>

                <div className="policy-prompt-grid">
                  {artifacts.map((artifact) => (
                    <article key={artifact.id} className="policy-prompt-card">
                      <div className="policy-prompt-card-head">
                        <div>
                          <h5>{artifact.name}</h5>
                          <p>{artifact.purpose}</p>
                        </div>
                        <div className="policy-prompt-badges">
                          <Badge tone="info">{artifact.version}</Badge>
                          <Badge tone="default">{artifact.fingerprint}</Badge>
                        </div>
                      </div>

                      <div className="policy-prompt-meta-grid">
                        <div>
                          <span>Owner</span>
                          <strong>{artifact.owner}</strong>
                        </div>
                        <div>
                          <span>Model</span>
                          <strong>{artifact.modelLabel}</strong>
                        </div>
                        <div>
                          <span>Temperature</span>
                          <strong>{artifact.temperature}</strong>
                        </div>
                        <div>
                          <span>Last Updated</span>
                          <strong>{artifact.lastUpdated}</strong>
                        </div>
                      </div>

                      <div className="policy-prompt-technical">
                        <div>
                          <div className="small muted" style={{ fontWeight: 700, marginBottom: 6 }}>
                            System Prompt (Exact)
                          </div>
                          <pre className="policy-prompt-code">{artifact.systemPrompt}</pre>
                        </div>
                        <div>
                          <div className="small muted" style={{ fontWeight: 700, marginBottom: 6 }}>
                            Input Sent To LLM (Current Template)
                          </div>
                          <pre className="policy-prompt-code">{artifact.inputTemplate}</pre>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <aside className="policy-tab-side">
            <div className="policy-side-card">
              <div className="small muted" style={{ fontWeight: 700, marginBottom: 8 }}>
                Prompt Sources
              </div>
              <div className="policy-source-list">
                {promptGovernanceSources.map((source) => (
                  <code key={source}>{source}</code>
                ))}
              </div>
            </div>

            <div className="policy-side-card">
              <div className="small muted" style={{ fontWeight: 700, marginBottom: 8 }}>
                Access & Guardrails
              </div>
              <div className="policy-guardrail-list">
                {promptCatalog.map((artifact) => (
                  <div key={`${artifact.id}-guardrail`} className="policy-guardrail-row">
                    <div>
                      <div style={{ fontWeight: 600 }}>{artifact.name}</div>
                      <div className="small muted">{artifact.visibilityNote}</div>
                    </div>
                    <div className="policy-guardrail-right">
                      <Badge tone="info">{artifact.version}</Badge>
                      <div className="small muted">{artifact.redactionNote}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {activeTab === 'journey' ? (
        <div className="policy-example-stack">
          <ExplainableDecisionDiagram example={workedExample} />

          <section className="policy-example-hero">
            <div>
              <h3 className="panel-title" style={{ marginBottom: 6 }}>
                Detailed Runner Flow: {workedExample.product.name}
              </h3>
              <p className="section-subtitle" style={{ marginTop: 0 }}>
                One self-explanatory path from subscription signals to quote insight output and
                reviewer action.
              </p>
            </div>
            <div className="policy-example-controls">
              <label className="policy-select-label" htmlFor="worked-policy-product-journey">
                Example Subscription
              </label>
              <select
                id="worked-policy-product-journey"
                className="policy-select"
                value={selectedProductId}
                onChange={(event) =>
                  setSelectedProductId(event.target.value as WorkedExampleProductId)
                }
              >
                {workedExampleOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="policy-example-badges">
              <Badge tone={getRiskTone(workedExample.scoring.finalRiskLevel)}>
                Risk {workedExample.scoring.finalRiskLevel} ({workedExample.scoring.finalRiskScore})
              </Badge>
              <Badge tone={getDispositionTone(workedExample.recommendation.disposition)}>
                {workedExample.recommendation.disposition}
              </Badge>
              <Badge tone={workedExample.guardrails.approvalRequired ? 'warn' : 'success'}>
                {workedExample.guardrails.approvalRequired ? 'Approval Required' : 'Within Policy'}
              </Badge>
              <Badge tone="info">Insight {workedExample.quoteInsight.insightType}</Badge>
            </div>
          </section>

          <ol className="policy-journey-list">
            <li className="policy-journey-step">
              <div className="policy-journey-head">
                <StepMarker step="1" engineLabel="Source Data" tone="data" />
                <h4>Subscription Signals Ingested</h4>
              </div>
              <p>
                Latest snapshot from {workedExample.sourceContext.latestSnapshotDate} for{' '}
                {workedExample.sourceContext.accountName} /{' '}
                {workedExample.sourceContext.subscriptionNumber}.
              </p>
              <div className="policy-journey-grid">
                <div className="policy-journey-item">
                  <div className="small muted">Usage</div>
                  <strong>{formatPercent(workedExample.inputs.usagePercentOfEntitlement)}</strong>
                </div>
                <div className="policy-journey-item">
                  <div className="small muted">Active Users</div>
                  <strong>{formatPercent(workedExample.inputs.activeUserPercent)}</strong>
                </div>
                <div className="policy-journey-item">
                  <div className="small muted">Login Trend</div>
                  <strong>{formatPercent(workedExample.inputs.loginTrend30d)}</strong>
                </div>
                <div className="policy-journey-item">
                  <div className="small muted">Tickets (90d)</div>
                  <strong>{workedExample.inputs.ticketCount90d}</strong>
                </div>
                <div className="policy-journey-item">
                  <div className="small muted">Sev1 (90d)</div>
                  <strong>{workedExample.inputs.sev1Count90d}</strong>
                </div>
                <div className="policy-journey-item">
                  <div className="small muted">CSAT</div>
                  <strong>{workedExample.inputs.csatScore.toFixed(1)}</strong>
                </div>
              </div>
            </li>

            <li className="policy-journey-step">
              <div className="policy-journey-head">
                <StepMarker step="2" engineLabel="Recommendation Engine" tone="rules" />
                <h4>Risk Scoring Rules Applied</h4>
              </div>
              <p>
                Signal thresholds were scored into risk {workedExample.scoring.finalRiskScore} (
                {workedExample.scoring.finalRiskLevel}).
              </p>
              <div className="policy-journey-tag-row">
                {workedExample.scoring.topContributors.slice(0, 4).map((step) => (
                  <span key={`${step.signal}-${step.points}`} className="policy-journey-tag">
                    {step.signal}: {step.points >= 0 ? '+' : ''}
                    {step.points}
                  </span>
                ))}
              </div>
            </li>

            <li className="policy-journey-step">
              <div className="policy-journey-head">
                <StepMarker step="3" engineLabel="Recommendation Engine" tone="rules" />
                <h4>Recommendation Rule Selected</h4>
              </div>
              <p>{workedExample.recommendation.ruleTriggered}</p>
              <div className="policy-journey-grid">
                <div className="policy-journey-item">
                  <div className="small muted">Disposition</div>
                  <strong>{workedExample.recommendation.disposition}</strong>
                </div>
                <div className="policy-journey-item">
                  <div className="small muted">Target Discount</div>
                  <strong>{formatPercent(workedExample.recommendation.targetDiscountPercent)}</strong>
                </div>
                <div className="policy-journey-item">
                  <div className="small muted">Proposed Quantity</div>
                  <strong>{workedExample.recommendation.proposedQuantity}</strong>
                </div>
                <div className="policy-journey-item">
                  <div className="small muted">ARR Delta</div>
                  <strong>{formatSignedCurrency(workedExample.recommendation.arrDelta)}</strong>
                </div>
              </div>
            </li>

            <li className="policy-journey-step">
              <div className="policy-journey-head">
                <StepMarker step="4" engineLabel="Pricing Guardrails" tone="guardrail" />
                <h4>Guardrails Checked</h4>
              </div>
              <div className="policy-journey-checks">
                {workedExample.guardrails.checks.map((check) => (
                  <div key={check.check} className="policy-journey-check">
                    <div>
                      <div style={{ fontWeight: 600 }}>{check.check}</div>
                      <div className="small muted">{check.formula}</div>
                    </div>
                    <Badge tone={check.outcome === 'TRIGGERED' ? 'warn' : 'success'}>
                      {check.outcome}
                    </Badge>
                  </div>
                ))}
              </div>
            </li>

            <li className="policy-journey-step">
              <div className="policy-journey-head">
                <StepMarker step="5" engineLabel="Quote Insight Engine" tone="insight" />
                <h4>Quote Insight Generated</h4>
              </div>
              <p>{workedExample.quoteInsight.mappingRule}</p>
              <div className="policy-journey-grid">
                <div className="policy-journey-item">
                  <div className="small muted">Insight Type</div>
                  <strong>{workedExample.quoteInsight.insightType}</strong>
                </div>
                <div className="policy-journey-item">
                  <div className="small muted">Confidence</div>
                  <strong>{workedExample.quoteInsight.confidenceScore}</strong>
                </div>
                <div className="policy-journey-item">
                  <div className="small muted">Fit Score</div>
                  <strong>{workedExample.quoteInsight.fitScore}</strong>
                </div>
                <div className="policy-journey-item">
                  <div className="small muted">Estimated ARR Impact</div>
                  <strong>{formatSignedCurrency(workedExample.quoteInsight.estimatedArrImpact)}</strong>
                </div>
              </div>
            </li>

            <li className="policy-journey-step">
              <div className="policy-journey-head">
                <StepMarker step="6" engineLabel="Human Workflow" tone="review" />
                <h4>Reviewer Action Outcome</h4>
              </div>
              <p>
                {workedExample.guardrails.approvalRequired
                  ? 'Outcome: route this recommendation for manager/deal-desk approval before final quote submission.'
                  : 'Outcome: recommendation is within policy and can move directly to quote drafting/review.'}
              </p>
              <div className="policy-journey-tag-row">
                <span className="policy-journey-tag">
                  Policy: {workedExample.policyContext.matchedPolicyName}
                </span>
                <span className="policy-journey-tag">
                  Final Guardrail: {workedExample.guardrails.finalGuardrailResult}
                </span>
                <span className="policy-journey-tag">
                  Quote Motion: {workedExample.quoteInsight.insightType}
                </span>
              </div>
            </li>
          </ol>
        </div>
      ) : null}

      {activeTab === 'example' ? (
        <div className="policy-example-stack">
          <section className="policy-example-hero">
            <div>
              <h3 className="panel-title" style={{ marginBottom: 6 }}>
                Example: {workedExample.product.name} ({workedExample.product.sku})
              </h3>
              <p className="section-subtitle" style={{ marginTop: 0 }}>
                Business-first walkthrough using seeded production-like data, then an optional
                technical drill-down of exactly how the policy engine produced the result.
              </p>
            </div>
            <div className="policy-example-controls">
              <label className="policy-select-label" htmlFor="worked-policy-product">
                Example Subscription
              </label>
              <select
                id="worked-policy-product"
                className="policy-select"
                value={selectedProductId}
                onChange={(event) =>
                  setSelectedProductId(event.target.value as WorkedExampleProductId)
                }
              >
                {workedExampleOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="policy-example-badges">
              <Badge tone={getRiskTone(workedExample.scoring.finalRiskLevel)}>
                Risk {workedExample.scoring.finalRiskLevel} ({workedExample.scoring.finalRiskScore})
              </Badge>
              <Badge tone={getDispositionTone(workedExample.recommendation.disposition)}>
                {workedExample.recommendation.disposition}
              </Badge>
              <Badge tone={workedExample.guardrails.approvalRequired ? 'warn' : 'success'}>
                {workedExample.guardrails.approvalRequired ? 'Approval Required' : 'Within Policy'}
              </Badge>
              <Badge tone="info">Insight {workedExample.quoteInsight.insightType}</Badge>
              <Badge tone="default">
                {workedExample.sourceContext.accountName} · {workedExample.sourceContext.subscriptionNumber}
              </Badge>
            </div>
          </section>

          <section className="policy-step-card">
            <div className="policy-step-head">
              <span>S</span>
              <h4>Seed Data Context</h4>
            </div>
            <div className="policy-example-grid">
              <div className="policy-example-item">
                <div className="small muted">Subscriptions Loaded</div>
                <div>{seedProfile.subscriptionCount}</div>
              </div>
              <div className="policy-example-item">
                <div className="small muted">Signal Snapshots</div>
                <div>{seedProfile.snapshotCount}</div>
              </div>
              <div className="policy-example-item">
                <div className="small muted">Avg Snapshots / Subscription</div>
                <div>{seedProfile.averageSnapshotsPerSubscription}</div>
              </div>
              <div className="policy-example-item">
                <div className="small muted">Snapshot Window</div>
                <div>{seedProfile.snapshotWindowLabel}</div>
              </div>
              <div className="policy-example-item">
                <div className="small muted">Login Trend Improving</div>
                <div>{seedProfile.improvingLoginTrendCount}</div>
              </div>
              <div className="policy-example-item">
                <div className="small muted">Login Trend Declining</div>
                <div>{seedProfile.decliningLoginTrendCount}</div>
              </div>
              <div className="policy-example-item">
                <div className="small muted">High Payment Risk</div>
                <div>{seedProfile.highPaymentRiskCount}</div>
              </div>
              <div className="policy-example-item">
                <div className="small muted">Example Snapshot Count</div>
                <div>{workedExample.sourceContext.snapshotCount}</div>
              </div>
            </div>
          </section>

          <section className="policy-step-card">
            <div className="policy-step-head">
              <span>0</span>
              <h4>Business Interpretation (Non-technical)</h4>
            </div>
            <div className="policy-business-summary">
              <div className="policy-business-headline">{businessInterpretation.headline}</div>
              <div className="small muted">{businessInterpretation.statusLine}</div>
            </div>
            <div className="policy-business-grid">
              <article className="policy-business-item">
                <div className="small muted">Current Situation</div>
                <div>{businessInterpretation.situation}</div>
              </article>
              <article className="policy-business-item">
                <div className="small muted">AI Recommended Move</div>
                <div>{businessInterpretation.recommendation}</div>
              </article>
              <article className="policy-business-item">
                <div className="small muted">Expected Business Outcome</div>
                <div>{businessInterpretation.impact}</div>
              </article>
              <article className="policy-business-item">
                <div className="small muted">Approval / Governance</div>
                <div>{businessInterpretation.approval}</div>
              </article>
            </div>
            <div className="policy-business-talktrack">
              <div className="small muted" style={{ fontWeight: 700 }}>
                Suggested business talk track
              </div>
              <ul>
                {businessInterpretation.talkTrack.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>

            <div className="policy-business-talktrack">
              <div className="small muted" style={{ fontWeight: 700 }}>
                How the engine works under the hood (business view)
              </div>
              <ul>
                <li>
                  Uses latest subscription signals from{' '}
                  {workedExample.sourceContext.latestSnapshotDate}, plus trend context from{' '}
                  {workedExample.sourceContext.snapshotWindowLabel}.
                </li>
                <li>
                  Converts signal thresholds into a risk score ({workedExample.scoring.finalRiskScore}
                  ) and maps that score to a disposition (
                  {workedExample.recommendation.disposition}).
                </li>
                <li>
                  Applies pricing guardrails from{' '}
                  {workedExample.policyContext.matchedPolicyName} before final approval status.
                </li>
                <li>
                  Emits insight type {workedExample.quoteInsight.insightType} for quote execution.
                </li>
              </ul>
            </div>
          </section>

          <section className="policy-step-card">
            <div className="policy-step-head">
              <span>A</span>
              <h4>Example Portfolio At a Glance</h4>
            </div>
            <p className="section-subtitle" style={{ marginTop: 0, marginBottom: 10 }}>
              Quick business summary of the currently loaded seeded examples.
            </p>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Business Signal</th>
                    <th>Suggested Move</th>
                    <th>ARR Impact</th>
                    <th>Policy Status</th>
                  </tr>
                </thead>
                <tbody>
                  {workedExampleBusinessRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.label}</td>
                      <td>{row.signalLabel}</td>
                      <td>{row.moveLabel}</td>
                      <td>{row.arrDelta}</td>
                      <td>{row.approvalLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="policy-step-card">
            <div className="policy-step-head">
              <span>B</span>
              <h4>Signal Trajectory (Based on Seed History)</h4>
            </div>
            <p className="section-subtitle" style={{ marginTop: 0, marginBottom: 10 }}>
              This helps business users understand whether the recommendation is based on improving,
              deteriorating, or mixed product health.
            </p>
            <div className="policy-example-grid">
              <div className="policy-example-item">
                <div className="small muted">Trend Direction</div>
                <div>{workedExample.signalTrend.trendDirection}</div>
              </div>
              <div className="policy-example-item">
                <div className="small muted">Usage Delta</div>
                <div>{formatSignedPercent(workedExample.signalTrend.usageDelta)}</div>
              </div>
              <div className="policy-example-item">
                <div className="small muted">Active Users Delta</div>
                <div>{formatSignedPercent(workedExample.signalTrend.activeUserDelta)}</div>
              </div>
              <div className="policy-example-item">
                <div className="small muted">Login Trend Delta</div>
                <div>{formatSignedPercent(workedExample.signalTrend.loginTrendDelta)}</div>
              </div>
              <div className="policy-example-item">
                <div className="small muted">Ticket Delta</div>
                <div>{formatSignedNumber(workedExample.signalTrend.ticketDelta)}</div>
              </div>
              <div className="policy-example-item">
                <div className="small muted">Sev1 Delta</div>
                <div>{formatSignedNumber(workedExample.signalTrend.sev1Delta)}</div>
              </div>
              <div className="policy-example-item">
                <div className="small muted">CSAT Delta</div>
                <div>{formatSignedNumber(workedExample.signalTrend.csatDelta)}</div>
              </div>
            </div>

            <div className="table-wrapper" style={{ marginTop: 12 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Snapshot Date</th>
                    <th>Usage</th>
                    <th>Active Users</th>
                    <th>Login Trend 30d</th>
                    <th>Tickets (90d)</th>
                    <th>Sev1 (90d)</th>
                    <th>CSAT</th>
                    <th>Payment Risk</th>
                    <th>Adoption Band</th>
                  </tr>
                </thead>
                <tbody>
                  {workedExample.signalTrend.timeline.map((point) => (
                    <tr key={`${workedExample.product.id}-${point.snapshotDate}`}>
                      <td>{point.snapshotDate}</td>
                      <td>{formatPercent(point.usagePercentOfEntitlement)}</td>
                      <td>{formatPercent(point.activeUserPercent)}</td>
                      <td>{formatPercent(point.loginTrend30d)}</td>
                      <td>{point.ticketCount90d}</td>
                      <td>{point.sev1Count90d}</td>
                      <td>{point.csatScore.toFixed(1)}</td>
                      <td>{point.paymentRiskBand}</td>
                      <td>{point.adoptionBand}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <details className="policy-technical-details">
            <summary>Technical calculation breakdown (optional)</summary>
            <div className="policy-technical-stack">
              <section className="policy-step-card">
                <div className="policy-step-head">
                  <span>1</span>
                  <h4>Input Snapshot</h4>
                </div>
                <div className="policy-example-grid">
                  <div className="policy-example-item">
                    <div className="small muted">Current Quantity</div>
                    <div>{workedExample.inputs.currentQuantity}</div>
                  </div>
                  <div className="policy-example-item">
                    <div className="small muted">List Unit Price</div>
                    <div>{formatCurrency(workedExample.inputs.listUnitPrice)}</div>
                  </div>
                  <div className="policy-example-item">
                    <div className="small muted">Current Discount</div>
                    <div>{formatPercent(workedExample.inputs.currentDiscountPercent)}</div>
                  </div>
                  <div className="policy-example-item">
                    <div className="small muted">Current ARR</div>
                    <div>{formatCurrency(workedExample.inputs.currentArr)}</div>
                  </div>
                  <div className="policy-example-item">
                    <div className="small muted">Usage</div>
                    <div>{formatPercent(workedExample.inputs.usagePercentOfEntitlement)}</div>
                  </div>
                  <div className="policy-example-item">
                    <div className="small muted">Active Users</div>
                    <div>{formatPercent(workedExample.inputs.activeUserPercent)}</div>
                  </div>
                  <div className="policy-example-item">
                    <div className="small muted">Login Trend (30d)</div>
                    <div>{formatPercent(workedExample.inputs.loginTrend30d)}</div>
                  </div>
                  <div className="policy-example-item">
                    <div className="small muted">CSAT</div>
                    <div>{workedExample.inputs.csatScore.toFixed(1)}</div>
                  </div>
                </div>
              </section>

              <section className="policy-step-card">
                <div className="policy-step-head">
                  <span>2</span>
                  <h4>Risk Score Contributions</h4>
                </div>
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Signal</th>
                        <th>Observed</th>
                        <th>Points</th>
                        <th>Running Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workedExample.scoring.steps.map((step) => (
                        <tr key={`${step.signal}-${step.observedValue}`}>
                          <td>{step.signal}</td>
                          <td>{step.observedValue}</td>
                          <td>{step.points >= 0 ? `+${step.points}` : `${step.points}`}</td>
                          <td>{step.runningScore}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {workedExample.scoring.topContributors.length > 0 ? (
                  <div className="policy-example-footnote" style={{ marginTop: 10 }}>
                    <div className="small muted" style={{ fontWeight: 700 }}>
                      Largest contributors
                    </div>
                    <div className="small muted">
                      {workedExample.scoring.topContributors
                        .map((step) => `${step.signal}: ${step.points >= 0 ? '+' : ''}${step.points}`)
                        .join(' · ')}
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="policy-step-card">
                <div className="policy-step-head">
                  <span>3</span>
                  <h4>Disposition and Commercial Recommendation</h4>
                </div>
                <div className="policy-example-grid">
                  <div className="policy-example-item">
                    <div className="small muted">Triggered Rule</div>
                    <div>{workedExample.recommendation.ruleTriggered}</div>
                  </div>
                  <div className="policy-example-item">
                    <div className="small muted">Disposition</div>
                    <div>{workedExample.recommendation.disposition}</div>
                  </div>
                  <div className="policy-example-item">
                    <div className="small muted">Target Discount</div>
                    <div>{formatPercent(workedExample.recommendation.targetDiscountPercent)}</div>
                  </div>
                  <div className="policy-example-item">
                    <div className="small muted">Proposed Quantity</div>
                    <div>{workedExample.recommendation.proposedQuantity}</div>
                  </div>
                  <div className="policy-example-item">
                    <div className="small muted">Proposed Net Unit Price</div>
                    <div>{formatCurrency(workedExample.recommendation.proposedNetUnitPrice)}</div>
                  </div>
                  <div className="policy-example-item">
                    <div className="small muted">Proposed ARR</div>
                    <div>{formatCurrency(workedExample.recommendation.proposedArr)}</div>
                  </div>
                  <div className="policy-example-item">
                    <div className="small muted">ARR Delta</div>
                    <div>{formatCurrency(workedExample.recommendation.arrDelta)}</div>
                  </div>
                </div>
              </section>

              <section className="policy-step-card">
                <div className="policy-step-head">
                  <span>4</span>
                  <h4>Guardrail Evaluation</h4>
                </div>
                <div className="policy-guardrail-list">
                  {workedExample.guardrails.checks.map((check) => (
                    <div key={check.check} className="policy-guardrail-row">
                      <div>
                        <div style={{ fontWeight: 600 }}>{check.check}</div>
                        <div className="small muted">{check.formula}</div>
                      </div>
                      <div className="policy-guardrail-right">
                        <Badge tone={check.outcome === 'TRIGGERED' ? 'warn' : 'success'}>
                          {check.outcome}
                        </Badge>
                        <div className="small muted">{check.impact}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="policy-step-card">
                <div className="policy-step-head">
                  <span>5</span>
                  <h4>Quote Insight Mapping Output</h4>
                </div>
                <div className="policy-example-grid">
                  <div className="policy-example-item">
                    <div className="small muted">Mapping Rule</div>
                    <div>{workedExample.quoteInsight.mappingRule}</div>
                  </div>
                  <div className="policy-example-item">
                    <div className="small muted">Insight Type</div>
                    <div>{workedExample.quoteInsight.insightType}</div>
                  </div>
                  <div className="policy-example-item">
                    <div className="small muted">Confidence Score</div>
                    <div>{workedExample.quoteInsight.confidenceScore}</div>
                  </div>
                  <div className="policy-example-item">
                    <div className="small muted">Fit Score</div>
                    <div>{workedExample.quoteInsight.fitScore}</div>
                  </div>
                  <div className="policy-example-item">
                    <div className="small muted">Incremental Quantity</div>
                    <div>{workedExample.quoteInsight.incrementalQuantity}</div>
                  </div>
                  <div className="policy-example-item">
                    <div className="small muted">Estimated ARR Impact</div>
                    <div>{formatCurrency(workedExample.quoteInsight.estimatedArrImpact)}</div>
                  </div>
                </div>

                <div className="policy-example-footnote">
                  <div className="small muted">
                    Policy context: {workedExample.policyContext.matchedPolicyName}
                  </div>
                  <div className="small muted">{workedExample.policyContext.matchingRule}</div>
                </div>
              </section>
            </div>
          </details>
        </div>
      ) : null}
    </section>
  )
}
