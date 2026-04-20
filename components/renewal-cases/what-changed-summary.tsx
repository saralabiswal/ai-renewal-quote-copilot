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
