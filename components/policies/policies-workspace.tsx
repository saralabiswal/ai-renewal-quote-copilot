'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import type { PricingPolicyView } from '@/lib/db/policies'
import type { RulebookSection } from '@/lib/policies/rule-reference'
import type {
  WorkedExampleProductId,
  WorkedExampleView,
} from '@/lib/policies/worked-example'

type TabId = 'recommendation' | 'insight' | 'example'

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
  const trendStory =
    loginTrend >= 8
      ? `Engagement trend is improving (${formatPercent(loginTrend)} over 30 days).`
      : loginTrend <= -10
        ? `Engagement trend is declining (${formatPercent(loginTrend)} over 30 days).`
        : `Engagement trend is relatively steady (${formatPercent(loginTrend)} over 30 days).`

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
    `Business signal: ${signalLabel}.`,
    `Recommended move: ${moveLabel}.`,
    `Commercial impact in this scenario: ${arrDeltaLabel} ARR.`,
    approvalStory,
  ]

  return {
    headline: `${example.product.name}: ${signalLabel}`,
    statusLine: `Overall risk is ${riskLabel}. Suggested motion is ${moveLabel.toLowerCase()}.`,
    situation: `${usageStory} ${trendStory}`,
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

export function PoliciesWorkspace({
  pricingPolicies,
  recommendationSections,
  recommendationSources,
  insightSections,
  insightSources,
  workedExamples,
  workedExampleOptions,
}: {
  pricingPolicies: PricingPolicyView[]
  recommendationSections: RulebookSection[]
  recommendationSources: readonly string[]
  insightSections: RulebookSection[]
  insightSources: readonly string[]
  workedExamples: Record<WorkedExampleProductId, WorkedExampleView>
  workedExampleOptions: Array<{
    id: WorkedExampleProductId
    label: string
  }>
}) {
  const [activeTab, setActiveTab] = useState<TabId>('example')
  const [selectedProductId, setSelectedProductId] = useState<WorkedExampleProductId>(
    workedExampleOptions[0]?.id ?? 'fusion_apps',
  )

  const workedExample =
    workedExamples[selectedProductId] ??
    workedExamples[workedExampleOptions[0]?.id ?? 'fusion_apps']
  const businessInterpretation = buildBusinessInterpretation(workedExample)
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
    }),
    [pricingPolicies, recommendationSections, insightSections],
  )

  return (
    <section className="card policy-workspace-shell">
      <div className="policy-workspace-head">
        <div>
          <h2 className="section-title">Policy Intelligence Workspace</h2>
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
        </div>
      </div>

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
      </div>

      {activeTab === 'recommendation' ? (
        <div className="policy-tab-layout">
          <div className="policy-tab-main">
            <RuleSectionAccordion sections={recommendationSections} />
          </div>

          <aside className="policy-tab-side">
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
            <RuleSectionAccordion sections={insightSections} />
          </div>

          <aside className="policy-tab-side">
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

      {activeTab === 'example' ? (
        <div className="policy-example-stack">
          <section className="policy-example-hero">
            <div>
              <h3 className="panel-title" style={{ marginBottom: 6 }}>
                Example: {workedExample.product.name} ({workedExample.product.sku})
              </h3>
              <p className="section-subtitle" style={{ marginTop: 0 }}>
                Business-first walkthrough: what the AI is suggesting, why it matters, and what
                decision to make.
              </p>
            </div>
            <div className="policy-example-controls">
              <label className="policy-select-label" htmlFor="worked-policy-product">
                Example Product
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
              <Badge tone={workedExample.scoring.finalRiskLevel === 'LOW' ? 'success' : workedExample.scoring.finalRiskLevel === 'MEDIUM' ? 'warn' : 'danger'}>
                Risk {workedExample.scoring.finalRiskLevel} ({workedExample.scoring.finalRiskScore})
              </Badge>
              <Badge tone={workedExample.recommendation.disposition === 'EXPAND' ? 'info' : workedExample.recommendation.disposition === 'ESCALATE' ? 'danger' : 'default'}>
                {workedExample.recommendation.disposition}
              </Badge>
              <Badge tone={workedExample.guardrails.approvalRequired ? 'warn' : 'success'}>
                {workedExample.guardrails.approvalRequired ? 'Approval Required' : 'Within Policy'}
              </Badge>
              <Badge tone="info">Insight {workedExample.quoteInsight.insightType}</Badge>
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
          </section>

          <section className="policy-step-card">
            <div className="policy-step-head">
              <span>A</span>
              <h4>All 3 Products At a Glance</h4>
            </div>
            <p className="section-subtitle" style={{ marginTop: 0, marginBottom: 10 }}>
              Use this as a quick business summary before reviewing detailed step-by-step logic.
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
