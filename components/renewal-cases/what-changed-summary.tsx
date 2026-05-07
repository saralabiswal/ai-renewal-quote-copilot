import type { ReactNode } from 'react'
import {
  QuoteInsightChangeView,
  QuoteInsightModifiedView,
  RecommendationChangeView,
} from '@/types/renewal-case'

const FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  insightSummary: 'Insight Summary',
  recommendedActionSummary: 'Recommended Action',
  confidenceScore: 'Confidence Score',
  fitScore: 'Fit Score',
  recommendedQuantity: 'Suggested Qty',
  recommendedUnitPrice: 'Unit Price',
  recommendedDiscountPercent: 'Discount %',
  estimatedArrImpact: 'ARR Impact',
}

function labelForField(field: string) {
  return FIELD_LABELS[field] ?? field
}

function formatApproval(value: boolean | null | undefined) {
  if (value == null) return '—'
  return value ? 'Yes' : 'No'
}

function humanizeLabel(value: string | null | undefined) {
  if (!value) return '—'
  if (/^[A-Z0-9_]+$/.test(value)) {
    return value
      .toLowerCase()
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  }

  return value
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

type QuoteInsightField = keyof QuoteInsightModifiedView['previous']

function formatFieldValue(
  field: QuoteInsightField,
  value: QuoteInsightModifiedView['previous'][QuoteInsightField],
) {
  if (value == null) return '—'

  if (typeof value === 'number') {
    if (field === 'recommendedDiscountPercent') return `${value}%`

    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2,
    }).format(value)
  }

  return humanizeLabel(String(value))
}

function insightKeyLabel(insightType: string, sku: string) {
  return `${humanizeLabel(insightType)} · ${sku}`
}

function statusClass(value: string | null | undefined) {
  const normalized = value?.toUpperCase()
  if (normalized === 'PASSED' || normalized === 'LLM') return 'success'
  if (normalized === 'REJECTED' || normalized === 'LLM_REJECTED') return 'danger'
  if (normalized === 'SKIPPED' || normalized === 'DETERMINISTIC_RULES') return 'warn'

  return 'default'
}

function formatSkuList(values: string[]) {
  if (values.length === 0) return 'None'
  return values.join(', ')
}

function formatTracePayload(value: unknown) {
  if (value == null || value === '') return 'Not captured for this run.'
  if (typeof value === 'string') return value

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function WhatChangedSummary({
  recommendation,
  insights,
  embedded = false,
}: {
  recommendation: RecommendationChangeView | null
  insights: QuoteInsightChangeView | null
  embedded?: boolean
}) {
  const recommendationUpdatedAt = formatDateTime(recommendation?.recalculatedAt ?? null)
  const insightsUpdatedAt = formatDateTime(insights?.regeneratedAt ?? null)
  const calculation = insights?.quoteInsightCalculation ?? null

  const hasInsightChanges = Boolean(
    (insights?.added?.length ?? 0) > 0 ||
      (insights?.removed?.length ?? 0) > 0 ||
      (insights?.modified?.length ?? 0) > 0,
  )

  const content = (
    <>
      <div className="section-header" style={{ marginBottom: 10 }}>
        <div>
          <h3 className="panel-title">What Changed</h3>
          <p className="section-subtitle">
            Shows how the active demo scenario changed the recommendation and quote actions.
          </p>
        </div>
      </div>

      {!recommendation && !insights ? (
        <div className="small muted">
          No change history yet. Run Regenerate Recommendation, then Regenerate Insights to
          see the delta.
        </div>
      ) : null}
      {recommendation || insights ? (
        <div className="what-changed-shell">
          {recommendation ? (
            <div className="what-changed-block">
              <div className="what-changed-block-head">
                <div className="what-changed-block-title">Recommendation</div>
                <div className="what-changed-meta">
                  {recommendation.scenarioLabel ? (
                    <span className="scenario-chip">Scenario: {recommendation.scenarioLabel}</span>
                  ) : null}
                  {recommendationUpdatedAt ? (
                    <span className="small muted">Updated: {recommendationUpdatedAt}</span>
                  ) : null}
                </div>
              </div>

              <div className="what-changed-recommendation-grid">
                <ChangeStat
                  label="Risk"
                  before={humanizeLabel(recommendation.previous?.riskLevel)}
                  after={humanizeLabel(recommendation.next?.riskLevel)}
                />
                <ChangeStat
                  label="Action"
                  before={humanizeLabel(recommendation.previous?.recommendedAction)}
                  after={humanizeLabel(recommendation.next?.recommendedAction)}
                />
                <ChangeStat
                  label="Approval"
                  before={formatApproval(recommendation.previous?.requiresApproval)}
                  after={formatApproval(recommendation.next?.requiresApproval)}
                />
              </div>
            </div>
          ) : null}

          {insights ? (
            <div className="what-changed-block">
              <div className="what-changed-block-head">
                <div className="what-changed-block-title">Quote Insight Changes</div>
                <div className="what-changed-meta">
                  {insights.scenarioKey ? (
                    <span className="scenario-chip">
                      Scenario: {humanizeLabel(insights.scenarioKey)}
                    </span>
                  ) : null}
                  {insightsUpdatedAt ? (
                    <span className="small muted">Updated: {insightsUpdatedAt}</span>
                  ) : null}
                </div>
              </div>

              {insights.engineVersion || insights.policyVersion ? (
                <div className="small muted" style={{ marginBottom: 10 }}>
                  Engine: {insights.engineVersion ?? 'N/A'} · Policy: {insights.policyVersion ?? 'N/A'}
                </div>
              ) : null}

              {calculation ? <QuoteInsightCalculationTrace calculation={calculation} /> : null}

              {!hasInsightChanges ? (
                <div className="small muted">
                  No quote insight delta was detected after regeneration.
                </div>
              ) : null}

              {hasInsightChanges ? (
                <div className="what-changed-delta-grid">
                  <ChangeGroup
                    title="Added"
                    tone="added"
                    count={insights.added.length}
                    emptyMessage="No new quote insights."
                  >
                    <ul className="what-changed-list">
                      {insights.added.map((item) => (
                        <li
                          key={`${item.insightType}-${item.productSkuSnapshot}`}
                          className="what-changed-list-item"
                        >
                          <div className="what-changed-list-title">
                            {item.title ?? insightKeyLabel(item.insightType, item.productSkuSnapshot)}
                          </div>
                          <div className="small muted">
                            {insightKeyLabel(item.insightType, item.productSkuSnapshot)}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </ChangeGroup>

                  <ChangeGroup
                    title="Removed"
                    tone="removed"
                    count={insights.removed.length}
                    emptyMessage="No removed quote insights."
                  >
                    <ul className="what-changed-list">
                      {insights.removed.map((item) => (
                        <li
                          key={`${item.insightType}-${item.productSkuSnapshot}`}
                          className="what-changed-list-item"
                        >
                          <div className="what-changed-list-title">
                            {item.title ?? insightKeyLabel(item.insightType, item.productSkuSnapshot)}
                          </div>
                          <div className="small muted">
                            {insightKeyLabel(item.insightType, item.productSkuSnapshot)}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </ChangeGroup>

                  <ChangeGroup
                    title="Modified"
                    tone="modified"
                    count={insights.modified.length}
                    emptyMessage="No modified quote insights."
                  >
                    <div className="what-changed-modified-list">
                      {insights.modified.map((item, index) => (
                        <details
                          key={`${item.insightType}-${item.productSkuSnapshot}-${index}`}
                          className="what-changed-modified-item"
                        >
                          <summary>
                            <span>
                              {item.title ?? insightKeyLabel(item.insightType, item.productSkuSnapshot)}
                            </span>
                            <span className="what-changed-count-badge">
                              {item.changedFields.length} field
                              {item.changedFields.length === 1 ? '' : 's'}
                            </span>
                          </summary>

                          <div className="what-changed-fields">
                            {item.changedFields.map((field) => {
                              const typedField = field as QuoteInsightField
                              return (
                                <div
                                  key={`${item.insightType}-${item.productSkuSnapshot}-${field}`}
                                  className="what-changed-field-row"
                                >
                                  <div className="what-changed-field-name">{labelForField(field)}</div>
                                  <div className="what-changed-field-values">
                                    <span className="what-changed-field-before">
                                      {formatFieldValue(typedField, item.previous[typedField])}
                                    </span>
                                    <span className="what-changed-field-arrow">→</span>
                                    <span className="what-changed-field-after">
                                      {formatFieldValue(typedField, item.next[typedField])}
                                    </span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </details>
                      ))}
                    </div>
                  </ChangeGroup>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  )

  if (embedded) {
    return <div style={{ marginTop: 16 }}>{content}</div>
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      {content}
    </div>
  )
}

function QuoteInsightCalculationTrace({
  calculation,
}: {
  calculation: NonNullable<QuoteInsightChangeView['quoteInsightCalculation']>
}) {
  const acceptedCount = calculation.acceptedProductSkus.length
  const rejectedCount = calculation.rejectedProductSkus.length
  const statusTone = statusClass(calculation.validationStatus)
  const generatedByTone = statusClass(calculation.generatedBy)

  return (
    <div className="quote-insight-calculation">
      <div className="quote-insight-calculation-head">
        <div>
          <div className="quote-insight-calculation-title">Quote Insight Calculation</div>
          <div className="small muted">
            Guarded LLM disposition is validated against deterministic quote insight candidates.
          </div>
        </div>
        <div className="quote-insight-calculation-badges">
          <span className={`badge ${generatedByTone}`}>{humanizeLabel(calculation.generatedBy)}</span>
          <span className={`badge ${statusTone}`}>
            Validation: {humanizeLabel(calculation.validationStatus)}
          </span>
        </div>
      </div>

      <div className="quote-insight-calculation-grid">
        <TraceStat label="Mode" value={humanizeLabel(calculation.mode)} />
        <TraceStat label="Model" value={calculation.modelLabel ?? 'Rules only'} />
        <TraceStat label="Accepted Products" value={String(acceptedCount)} />
        <TraceStat label="Rejected Products" value={String(rejectedCount)} />
      </div>

      <div className="quote-insight-calculation-products">
        <div>
          <div className="quote-insight-calculation-label">Accepted</div>
          <div className="small muted">{formatSkuList(calculation.acceptedProductSkus)}</div>
        </div>
        <div>
          <div className="quote-insight-calculation-label">Fallback / Rejected</div>
          <div className="small muted">
            {calculation.fallbackReason ?? formatSkuList(calculation.rejectedProductSkus)}
          </div>
        </div>
      </div>

      <details className="quote-insight-calculation-details">
        <summary>
          <span>Validation Checks</span>
          <span className="what-changed-count-badge">{calculation.checks.length}</span>
        </summary>
        <div className="quote-insight-calculation-checks">
          {calculation.checks.length === 0 ? (
            <div className="small muted">No validation checks were recorded.</div>
          ) : (
            calculation.checks.map((check, index) => (
              <div
                key={`${check.name}-${index}`}
                className="quote-insight-calculation-check"
              >
                <div className="quote-insight-calculation-check-head">
                  <span>{check.name}</span>
                  <span className={`badge ${statusClass(check.status)}`}>
                    {humanizeLabel(check.status)}
                  </span>
                </div>
                {check.detail ? <div className="small muted">{check.detail}</div> : null}
              </div>
            ))
          )}
        </div>
      </details>

      <div className="quote-insight-calculation-io">
        <TracePayloadDetails
          title="Prompt Input"
          helper="Exact JSON payload sent as the user message for guarded Quote Insight disposition."
          payload={calculation.promptInput}
        />
        <TracePayloadDetails
          title="LLM Raw Output"
          helper="Raw text returned by the model before guarded validation."
          payload={calculation.rawText}
        />
      </div>

      {calculation.systemPrompt ? (
        <TracePayloadDetails
          title="System Prompt"
          helper="Exact system instruction sent with the Quote Insight disposition request."
          payload={calculation.systemPrompt}
        />
      ) : null}

      <div className="quote-insight-calculation-versions">
        <span>Prompt: {calculation.promptVersion ?? 'N/A'}</span>
        <span>Validator: {calculation.validationVersion ?? 'N/A'}</span>
      </div>
    </div>
  )
}

function TracePayloadDetails({
  title,
  helper,
  payload,
}: {
  title: string
  helper: string
  payload: unknown
}) {
  return (
    <details className="quote-insight-calculation-payload">
      <summary>
        <span>{title}</span>
      </summary>
      <div className="small muted">{helper}</div>
      <pre>{formatTracePayload(payload)}</pre>
    </details>
  )
}

function TraceStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="quote-insight-calculation-stat">
      <div className="quote-insight-calculation-label">{label}</div>
      <div>{value}</div>
    </div>
  )
}

function ChangeStat({
  label,
  before,
  after,
}: {
  label: string
  before: string
  after: string
}) {
  return (
    <div className="what-changed-stat">
      <div className="what-changed-stat-label">{label}</div>
      <div className="what-changed-stat-values">
        <div className="what-changed-stat-before">Before: {before}</div>
        <div className="what-changed-stat-after">After: {after}</div>
      </div>
    </div>
  )
}

function ChangeGroup({
  title,
  tone,
  count,
  children,
  emptyMessage,
}: {
  title: string
  tone: 'added' | 'removed' | 'modified'
  count: number
  children: ReactNode
  emptyMessage: string
}) {
  return (
    <div className={`what-changed-column what-changed-column-${tone}`}>
      <div className="what-changed-column-head">
        <div className="what-changed-column-title">{title}</div>
        <span className="what-changed-count-badge">{count}</span>
      </div>

      {count === 0 ? <div className="small muted">{emptyMessage}</div> : children}
    </div>
  )
}
