import { AddQuoteInsightToQuoteButton } from '@/components/renewal-cases/add-quote-insight-to-quote-button'
import { Badge } from '@/components/ui/badge'
import { buildQuoteInsightInput, quoteInsightInstructions } from '@/lib/ai/prompts'
import { labelize } from '@/lib/format/risk'

type QuoteInsightView = {
  id: string
  title: string
  insightType: string
  insightTypeLabel: string
  statusLabel: string
  statusTone?: 'default' | 'info' | 'success' | 'warn' | 'danger'
  isAddedToQuote?: boolean
  productName: string
  productSku: string
  productFamily: string
  insightSummary: string
  recommendedActionSummary: string | null
  aiExplanation: string | null
  aiModelLabel: string | null
  confidenceScore: number | null
  fitScore: number | null
  recommendedQuantity: number | null
  recommendedUnitPriceFormatted: string | null
  recommendedDiscountPercentFormatted: string | null
  estimatedArrImpactFormatted: string | null
  justification: {
    version: string
    sourceType: string
    insightType: string
    scenarioKey: string | null
    reasoning: string[]
    signals: { label: string; value: string | number | boolean | null }[]
    commercialDelta: {
      currentQuantity: number | null
      proposedQuantity: number | null
      quantityDelta: number | null
      currentArr: number | null
      proposedArr: number | null
      arrDelta: number | null
      currentUnitPrice: number | null
      proposedUnitPrice: number | null
      recommendedDiscountPercent: number | null
    } | null
    decisionMeta?: {
      decisionRunId: string | null
      generatedAt: string | null
      actor: string | null
      engineVersion: string | null
      policyVersion: string | null
      scenarioVersion: string | null
      sourceRecordVersion: string | null
    } | null
    reasonCodes?: string[]
    ruleHits?: Array<{
      ruleId: string
      reasonCode: string
      outcome: string
      weight: number | null
      detail: string
    }>
    alternativesConsidered?: Array<{
      action: string
      reasonRejected: string
    }>
    expectedImpact?: {
      arrDelta: number | null
      marginDirection: string | null
      retentionRisk: string | null
    } | null
    objectiveLens?: {
      primaryObjective: 'RETAIN_REVENUE' | 'PROTECT_MARGIN' | 'GROW_ACCOUNT' | 'GOVERN_RISK'
      objectiveScore: number | null
      businessKpi: string
      signalDrivers: string[]
    } | null
    ml?: {
      status: string
      affectsRecommendation: boolean
      riskScore: number | null
      riskProbability: number | null
      expansionScore: number | null
      expansionProbability: number | null
      topFeatures: string[]
    } | null
    changeLog?: {
      fromSummary: string | null
      toSummary: string | null
      changedFields: string[]
      changedAt: string | null
    } | null
  } | null
}

type BadgeTone = 'default' | 'info' | 'success' | 'warn' | 'danger'

function mlParticipationLabel(affectsRecommendation: boolean) {
  return affectsRecommendation ? 'ML-Assisted Rules' : 'Shadow Mode'
}

function isLocalRationaleLabel(modelLabel: string | null) {
  if (!modelLabel) return false
  const normalized = modelLabel.toLowerCase()
  return normalized.includes('fallback') || normalized.includes('local-quote-insight-rationale')
}

function quoteInsightRationaleLabel(modelLabel: string | null) {
  if (!modelLabel) return null
  if (isLocalRationaleLabel(modelLabel)) return 'Rationale: Local deterministic v1'
  return `Model: ${modelLabel}`
}

export function QuoteInsightsPanel({
  caseId,
  accountName,
  items,
  currencyCode,
  needsRefresh = false,
  generatedAtLabel = null,
}: {
  caseId: string
  accountName: string
  items: QuoteInsightView[]
  currencyCode: string
  needsRefresh?: boolean
  generatedAtLabel?: string | null
}) {
  return (
    <div className="card">
      <div className="section-header" style={{ marginBottom: 16 }}>
        <div>
          <h3 className="panel-title">Quote Insights</h3>
          <p className="section-subtitle">
            Review and apply quote actions generated from the current quote recommendation.
          </p>
        </div>
      </div>

      {needsRefresh ? (
        <div
          className="card"
          style={{
            marginBottom: 16,
            paddingTop: 12,
            paddingBottom: 12,
            border: '1px solid var(--border)',
            background: 'rgba(245, 158, 11, 0.08)',
          }}
        >
          <div style={{ fontWeight: 600 }}>Quote Insights may be outdated</div>
          <div className="small muted" style={{ marginTop: 6 }}>
            Scenario or recommendation changed. Regenerate Insights to align quote actions
            with the latest recommendation.
          </div>
          <div className="small muted" style={{ marginTop: 4 }}>
            Next step: in Section A, click <strong>Regenerate Insights + AI Rationale</strong>, then
            return here to apply updated quote actions.
          </div>
        </div>
      ) : generatedAtLabel ? (
        <div className="small muted" style={{ marginBottom: 16 }}>
          Last regenerated: {generatedAtLabel}
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="empty-note">
          No quote insights are currently suggested for this case. Next step: run Regenerate
          Insights + AI Rationale in Section A.
        </div>
      ) : (
        <div className="opportunity-list">
          {items.map((item, index) => {
            const hasAiRationale = Boolean(item.aiExplanation)
            const aiFreshnessTone: BadgeTone =
              needsRefresh || !hasAiRationale ? 'warn' : 'success'
            const aiFreshnessLabel = needsRefresh
              ? 'Needs AI Refresh'
              : hasAiRationale
                ? 'AI Ready'
                : 'Needs AI Generation'

            const confidenceBand = scoreBand(item.confidenceScore)
            const fitBand = scoreBand(item.fitScore)
            const reasonCodes = item.justification?.reasonCodes ?? []
            const ruleHits = item.justification?.ruleHits ?? []
            const alternatives = item.justification?.alternativesConsidered ?? []
            const changeLog = item.justification?.changeLog ?? null
            const objectiveLens = item.justification?.objectiveLens ?? null
            const mlInsight = item.justification?.ml ?? null
            const objectiveBand = scoreBand(objectiveLens?.objectiveScore ?? null)
            const aiNarrative = parseAiNarrativeSections(item.aiExplanation)
            const aiDecisionFallback =
              item.recommendedActionSummary == null
                ? aiNarrative?.decision ?? null
                : null
            const aiWhyFallback = item.insightSummary ? null : aiNarrative?.why ?? null
            const aiWhatChangedFallback =
              changeLog == null ? aiNarrative?.whatChanged ?? null : null
            const aiCommercialImpact = aiNarrative?.commercialImpact ?? null
            const aiNarrativeRemainder = aiNarrative?.unstructured ?? null
            const isLocalRationale = isLocalRationaleLabel(item.aiModelLabel)
            const rationaleLabel = quoteInsightRationaleLabel(item.aiModelLabel)
            const hasUniqueStructuredAiContent = Boolean(
              aiCommercialImpact ||
                aiDecisionFallback ||
                aiWhyFallback ||
                aiWhatChangedFallback ||
                aiNarrativeRemainder,
            )
            const exactSystemPrompt = quoteInsightInstructions()
            const exactPromptInput = buildQuoteInsightInput({
              accountName,
              title: item.title,
              insightType: item.insightType,
              productName: item.productName,
              insightSummary: item.insightSummary,
              recommendedActionSummary: item.recommendedActionSummary,
              confidenceScore: item.confidenceScore,
              fitScore: item.fitScore,
              reasonCodes,
              structuredReasoning: item.justification?.reasoning ?? [],
              whatChangedSummary: buildWhatChangedSummary(changeLog),
              expectedImpactSummary: buildExpectedImpactSummary(item.justification?.expectedImpact ?? null),
            })

            return (
              <div key={item.id} className="opportunity-card">
                <div className="opportunity-top-row">
                  <div style={{ width: '100%' }}>
                    <div className="opportunity-title-row">
                      <div className="opportunity-title">{item.title}</div>
                      <span className="scenario-chip">{item.insightTypeLabel}</span>
                      {item.statusTone ? (
                        <Badge tone={item.statusTone}>{item.statusLabel}</Badge>
                      ) : (
                        <span className="scenario-chip">{item.statusLabel}</span>
                      )}
                    </div>

                    <div className="opportunity-product-meta">
                      <span>{item.productName}</span>
                      <span>•</span>
                      <span>{item.productSku}</span>
                      <span>•</span>
                      <span>{item.productFamily}</span>
                    </div>

                    <div className="quote-insight-ai-meta">
                      <Badge tone={aiFreshnessTone}>{aiFreshnessLabel}</Badge>
                      <Badge tone={confidenceBand.tone}>Confidence: {confidenceBand.label}</Badge>
                      <Badge tone={fitBand.tone}>Fit: {fitBand.label}</Badge>
                      {rationaleLabel ? (
                        <span className="scenario-chip">{rationaleLabel}</span>
                      ) : null}
                      {mlInsight ? (
                        <Badge tone={mlInsight.affectsRecommendation ? 'info' : 'default'}>
                          {mlParticipationLabel(mlInsight.affectsRecommendation)}:{' '}
                          {mlInsight.riskScore != null ? Math.round(mlInsight.riskScore) : 'N/A'}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="small muted" style={{ marginTop: 6 }}>
                      Confidence: {confidenceBand.helpText} Fit: {fitBand.helpText}
                    </div>

                    {objectiveLens ? (
                      <div style={{ marginTop: 8 }}>
                        <div className="quote-insight-ai-meta">
                          <Badge tone="info">
                            Objective: {humanizeToken(objectiveLens.primaryObjective)}
                          </Badge>
                          <Badge tone={objectiveBand.tone}>
                            Objective Score: {objectiveBand.label}
                          </Badge>
                        </div>
                        <div className="small muted" style={{ marginTop: 6 }}>
                          KPI target: {objectiveLens.businessKpi}
                        </div>
                        {objectiveLens.signalDrivers.length > 0 ? (
                          <ul className="quote-insight-evidence-list" style={{ marginTop: 6 }}>
                            {objectiveLens.signalDrivers.map((driver, driverIndex) => (
                              <li key={`${item.id}-objective-driver-${driverIndex}`}>{driver}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                <details className="quote-insight-prompt-details">
                  <summary className="quote-insight-prompt-summary">
                    <span>View Prompt Used</span>
                    <span className="small muted">
                      {isLocalRationale
                        ? 'Prompt template retained for audit; no LLM call was made'
                        : 'Exact current prompt used by the LLM'}
                    </span>
                  </summary>
                  <div className="quote-insight-prompt-body">
                    <article className="quote-insight-prompt-card">
                      <div className="quote-insight-prompt-card-head">
                        <div>
                          <div style={{ fontWeight: 700 }}>Quote Insight Rationale Prompt</div>
                          <div className="small muted">
                            {isLocalRationale
                              ? 'Execution path: Local deterministic rationale'
                              : `Current model: ${item.aiModelLabel ?? 'Runtime OPENAI_MODEL'}`}
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="quote-insight-step-label">System Prompt (Exact)</div>
                        <pre className="quote-insight-prompt-code">{exactSystemPrompt}</pre>
                      </div>
                      <div>
                        <div className="quote-insight-step-label">
                          {isLocalRationale
                            ? 'Input Assembled For Rationale'
                            : 'Input Sent To LLM (Exact)'}
                        </div>
                        <pre className="quote-insight-prompt-code">{exactPromptInput}</pre>
                      </div>
                    </article>
                  </div>
                </details>

                <div className="quote-insight-primary">
                  <div className="quote-insight-step-label">Decision</div>
                  <p className="opportunity-expected-value">
                    {item.recommendedActionSummary ?? 'No action recommendation available.'}
                  </p>
                </div>

                <details className="quote-insight-details" open={index === 0}>
                  <summary className="quote-insight-details-summary">
                    <span>Review Details</span>
                    <span className="small muted">
                      {changeLog ? 'Why, What Changed, AI context, and evidence' : 'Why, AI context, and evidence'}
                    </span>
                  </summary>

                  <div className="quote-insight-details-content">
                    <div className="quote-insight-flow">
                      <div className="quote-insight-step">
                        <div className="quote-insight-step-label">Why</div>
                        <p className="opportunity-reason">{item.insightSummary}</p>
                      </div>

                      {changeLog ? (
                        <div className="quote-insight-step">
                          <div className="quote-insight-step-label">What Changed</div>
                          <p className="opportunity-reason">
                            {changeLog.fromSummary
                              ? `Before: ${changeLog.fromSummary}`
                              : 'This insight is newly added in the latest regeneration.'}
                          </p>
                          <p className="opportunity-expected-value">
                            Now:{' '}
                            {changeLog.toSummary ??
                              item.recommendedActionSummary ??
                              'No new summary available.'}
                          </p>
                          {changeLog.changedFields.length > 0 ? (
                            <div className="small muted">
                              Changed fields: {changeLog.changedFields.map(humanizeToken).join(', ')}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="quote-insight-step">
                        <div className="quote-insight-step-label">AI Added Context</div>
                        {!item.aiExplanation ? (
                          <p className="opportunity-ai-explanation muted">
                            AI rationale is not generated yet. Use Regenerate Insights + AI Rationale
                            to generate reviewer-facing reasoning.
                          </p>
                        ) : aiNarrative?.hasStructuredContent ? (
                          hasUniqueStructuredAiContent ? (
                            <div style={{ display: 'grid', gap: 8 }}>
                              {aiCommercialImpact ? (
                                <div>
                                  <div className="quote-insight-step-label">Commercial Impact</div>
                                  <p className="opportunity-ai-explanation">{aiCommercialImpact}</p>
                                </div>
                              ) : null}
                              {aiDecisionFallback ? (
                                <div>
                                  <div className="quote-insight-step-label">Decision</div>
                                  <p className="opportunity-ai-explanation">{aiDecisionFallback}</p>
                                </div>
                              ) : null}
                              {aiWhyFallback ? (
                                <div>
                                  <div className="quote-insight-step-label">Why</div>
                                  <p className="opportunity-ai-explanation">{aiWhyFallback}</p>
                                </div>
                              ) : null}
                              {aiWhatChangedFallback ? (
                                <div>
                                  <div className="quote-insight-step-label">What Changed</div>
                                  <p className="opportunity-ai-explanation">{aiWhatChangedFallback}</p>
                                </div>
                              ) : null}
                              {aiNarrativeRemainder ? (
                                <p className="opportunity-ai-explanation">{aiNarrativeRemainder}</p>
                              ) : null}
                            </div>
                          ) : (
                            <p className="opportunity-ai-explanation muted">
                              AI narrative is already represented above in Decision, Why, and What
                              Changed.
                            </p>
                          )
                        ) : (
                          <p className="opportunity-ai-explanation">{item.aiExplanation}</p>
                        )}
                      </div>

                      {item.justification?.reasoning.length ? (
                        <div className="quote-insight-step">
                          <div className="quote-insight-step-label">Evidence-Based Reasoning</div>
                          <ul className="quote-insight-evidence-list" style={{ marginTop: 4 }}>
                            {item.justification.reasoning.map((point, reasonIndex) => (
                              <li key={`${item.id}-visible-reason-${reasonIndex}`}>{point}</li>
                            ))}
                          </ul>
                          <div className="small muted">
                            Structured quote evidence. This explains the insight; pricing policy
                            and recommendation mode remain governed by the decision run.
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <details className="quote-insight-evidence">
                      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                        Structured Evidence (Read-only)
                      </summary>

                      {item.justification ? (
                        <div className="quote-insight-evidence-content">
                          <div className="small muted">
                            Source: {humanizeToken(item.justification.sourceType)} • Insight Type:{' '}
                            {humanizeToken(item.justification.insightType)} • Scenario:{' '}
                            {humanizeToken(item.justification.scenarioKey ?? 'BASE_CASE')} • Version:{' '}
                            {item.justification.version}
                          </div>

                          {item.justification.decisionMeta ? (
                            <div className="small muted" style={{ lineHeight: 1.5 }}>
                              Engine: {item.justification.decisionMeta.engineVersion ?? 'N/A'} •
                              Policy: {item.justification.decisionMeta.policyVersion ?? 'N/A'} •
                              Actor: {item.justification.decisionMeta.actor ?? 'N/A'}
                            </div>
                          ) : null}

                          {item.justification.ml ? (
                            <div className="quote-insight-ai-meta" style={{ marginTop: 8 }}>
                              <Badge
                                tone={
                                  item.justification.ml.affectsRecommendation ? 'info' : 'default'
                                }
                              >
                                {mlParticipationLabel(item.justification.ml.affectsRecommendation)}:{' '}
                                {labelize(item.justification.ml.status)}
                              </Badge>
                              {item.justification.ml.riskScore != null ? (
                                <Badge tone="warn">
                                  ML Risk: {Math.round(item.justification.ml.riskScore)}
                                </Badge>
                              ) : null}
                              {item.justification.ml.expansionScore != null ? (
                                <Badge tone="success">
                                  ML Expansion: {Math.round(item.justification.ml.expansionScore)}
                                </Badge>
                              ) : null}
                            </div>
                          ) : null}

                          {reasonCodes.length > 0 ? (
                            <div className="quote-insight-ai-meta" style={{ marginTop: 2 }}>
                              {reasonCodes.map((code) => (
                                <span key={`${item.id}-${code}`} className="scenario-chip">
                                  {humanizeToken(code)}
                                </span>
                              ))}
                            </div>
                          ) : null}

                          {item.justification.reasoning.length > 0 ? (
                            <ul className="quote-insight-evidence-list">
                              {item.justification.reasoning.map((point, reasonIndex) => (
                                <li key={`${item.id}-reason-${reasonIndex}`}>{point}</li>
                              ))}
                            </ul>
                          ) : (
                            <div className="small muted">
                              No reasoning statements were provided for this insight.
                            </div>
                          )}

                          {item.justification.signals.length > 0 ? (
                            <div className="quote-insight-signal-grid">
                              {item.justification.signals.map((signal, signalIndex) => (
                                <Metric
                                  key={`${item.id}-signal-${signalIndex}`}
                                  label={signal.label}
                                  value={formatSignalValue(signal.value)}
                                />
                              ))}
                            </div>
                          ) : null}

                          {ruleHits.length > 0 ? (
                            <div>
                              <div className="quote-insight-step-label">Triggered Rules</div>
                              <ul className="quote-insight-evidence-list">
                                {ruleHits.map((hit) => (
                                  <li key={`${item.id}-${hit.ruleId}-${hit.reasonCode}`}>
                                    {humanizeToken(hit.ruleId)} ({humanizeToken(hit.reasonCode)}):{' '}
                                    {hit.detail}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}

                          {item.justification.commercialDelta ? (
                            <div className="quote-insight-commercial-grid">
                              <Metric
                                label="Qty Delta"
                                value={formatSignedNumber(item.justification.commercialDelta.quantityDelta)}
                              />
                              <Metric
                                label="ARR Delta"
                                value={formatSignedCurrency(
                                  item.justification.commercialDelta.arrDelta,
                                  currencyCode,
                                )}
                              />
                              <Metric
                                label="Unit Price (Proposed)"
                                value={formatCurrencyValue(
                                  item.justification.commercialDelta.proposedUnitPrice,
                                  currencyCode,
                                )}
                              />
                              <Metric
                                label="Discount (Recommended)"
                                value={formatPercentValue(
                                  item.justification.commercialDelta.recommendedDiscountPercent,
                                )}
                              />
                            </div>
                          ) : null}

                          {alternatives.length > 0 ? (
                            <details>
                              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                                Alternatives considered
                              </summary>
                              <ul className="quote-insight-evidence-list" style={{ marginTop: 8 }}>
                                {alternatives.map((option, alternativeIndex) => (
                                  <li key={`${item.id}-alt-${alternativeIndex}`}>
                                    {humanizeToken(option.action)}: {option.reasonRejected}
                                  </li>
                                ))}
                              </ul>
                            </details>
                          ) : null}
                        </div>
                      ) : (
                        <div className="small muted" style={{ marginTop: 10 }}>
                          Structured evidence is not available for this insight yet.
                        </div>
                      )}
                    </details>

                    <details style={{ marginTop: 12 }}>
                      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                        Score & Pricing Details
                      </summary>

                      <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
                        <div
                          className="opportunity-metrics-grid"
                          style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
                        >
                          <Metric
                            label="Confidence Score"
                            value={item.confidenceScore != null ? `${item.confidenceScore}` : '—'}
                          />
                          <Metric label="Fit Score" value={item.fitScore != null ? `${item.fitScore}` : '—'} />
                          <Metric
                            label="ML Risk Score"
                            value={
                              item.justification?.ml?.riskScore != null
                                ? `${Math.round(item.justification.ml.riskScore)}`
                                : '—'
                            }
                          />
                          <Metric
                            label="ML Expansion Score"
                            value={
                              item.justification?.ml?.expansionScore != null
                                ? `${Math.round(item.justification.ml.expansionScore)}`
                                : '—'
                            }
                          />
                        </div>
                      </div>
                    </details>
                  </div>
                </details>

                <div
                  className="opportunity-metrics-grid"
                  style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
                >
                  <Metric label="ARR Impact" value={item.estimatedArrImpactFormatted ?? '—'} />
                  <Metric
                    label="Suggested Qty"
                    value={item.recommendedQuantity != null ? `${item.recommendedQuantity}` : '—'}
                  />
                  <Metric
                    label="Price / Discount"
                    value={
                      [item.recommendedUnitPriceFormatted, item.recommendedDiscountPercentFormatted]
                        .filter(Boolean)
                        .join(' • ') || '—'
                    }
                  />
                </div>

                <div className="opportunity-actions">
                  {item.isAddedToQuote ? (
                    <button type="button" className="button-success" disabled>
                      Added to Quote
                    </button>
                  ) : (
                    <AddQuoteInsightToQuoteButton
                      caseId={caseId}
                      quoteInsightId={item.id}
                      insightType={item.insightType}
                    />
                  )}

                  <button type="button" className="button-secondary" disabled>
                    Dismiss
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="opportunity-metric">
      <div className="muted">{label}</div>
      <div>{value}</div>
    </div>
  )
}

function scoreBand(score: number | null): { label: string; tone: BadgeTone; helpText: string } {
  if (score == null) {
    return { label: 'Unscored', tone: 'default', helpText: 'insufficient signals.' }
  }
  if (score >= 85) {
    return { label: 'High', tone: 'success', helpText: 'strong evidence with low conflict.' }
  }
  if (score >= 70) {
    return { label: 'Medium', tone: 'info', helpText: 'good evidence with manageable trade-offs.' }
  }
  return { label: 'Low', tone: 'warn', helpText: 'conflicting or weak signal quality.' }
}

function humanizeToken(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatSignalValue(value: string | number | boolean | null) {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)
  }
  return value
}

function formatSignedNumber(value: number | null) {
  if (value === null || value === undefined) return '—'
  const absolute = Math.abs(value)
  const formatted = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(absolute)
  return `${value >= 0 ? '+' : '-'}${formatted}`
}

function formatCurrencyValue(value: number | null, currencyCode: string) {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatSignedCurrency(value: number | null, currencyCode: string) {
  if (value === null || value === undefined) return '—'
  const absolute = Math.abs(value)
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(absolute)
  return `${value >= 0 ? '+' : '-'}${formatted}`
}

function formatPercentValue(value: number | null) {
  if (value === null || value === undefined) return '—'
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)}%`
}

function buildExpectedImpactSummary(
  impact: {
    arrDelta: number | null
    marginDirection: string | null
    retentionRisk: string | null
  } | null,
) {
  if (!impact) return null

  const arrDelta =
    impact.arrDelta == null
      ? 'N/A'
      : `${impact.arrDelta >= 0 ? '+' : ''}${impact.arrDelta.toLocaleString('en-US')}`
  const marginDirection = impact.marginDirection?.toLowerCase() ?? 'unknown'
  const retentionRisk = impact.retentionRisk?.toLowerCase() ?? 'unknown'
  return `Estimated ARR delta ${arrDelta}; margin direction ${marginDirection}; retention risk ${retentionRisk}.`
}

function buildWhatChangedSummary(
  changeLog: {
    fromSummary: string | null
    toSummary: string | null
    changedFields: string[]
  } | null,
) {
  if (!changeLog) return 'No material change context supplied'
  if (changeLog.fromSummary) {
    const fields = changeLog.changedFields.length > 0 ? changeLog.changedFields.join(', ') : 'summary'
    return `Changed fields: ${fields}. Previous: ${changeLog.fromSummary}. Current: ${changeLog.toSummary ?? 'N/A'}.`
  }
  return `New insight added in the latest regeneration. Current: ${changeLog.toSummary ?? 'N/A'}.`
}

type AiNarrativeSectionKey = 'decision' | 'why' | 'commercialImpact' | 'whatChanged'

type ParsedAiNarrative = {
  decision: string | null
  why: string | null
  commercialImpact: string | null
  whatChanged: string | null
  unstructured: string | null
  hasStructuredContent: boolean
}

function parseAiNarrativeSections(content: string | null): ParsedAiNarrative | null {
  if (!content) return null

  const sections: Record<AiNarrativeSectionKey, string[]> = {
    decision: [],
    why: [],
    commercialImpact: [],
    whatChanged: [],
  }
  const unstructured: string[] = []
  let currentSection: AiNarrativeSectionKey | null = null

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) {
      if (currentSection && sections[currentSection].length > 0) {
        sections[currentSection].push('')
      }
      continue
    }

    const heading = matchAiNarrativeHeading(line)
    if (heading) {
      currentSection = heading.key
      if (heading.inlineValue) {
        sections[currentSection].push(heading.inlineValue)
      }
      continue
    }

    if (currentSection) {
      sections[currentSection].push(line)
    } else {
      unstructured.push(line)
    }
  }

  const decision = normalizeNarrativeText(sections.decision)
  const why = normalizeNarrativeText(sections.why)
  const commercialImpact = normalizeNarrativeText(sections.commercialImpact)
  const whatChanged = normalizeNarrativeText(sections.whatChanged)
  const unstructuredText = normalizeNarrativeText(unstructured)
  const hasStructuredContent = Boolean(decision || why || commercialImpact || whatChanged)

  return {
    decision,
    why,
    commercialImpact,
    whatChanged,
    unstructured: unstructuredText,
    hasStructuredContent,
  }
}

function matchAiNarrativeHeading(
  line: string,
): { key: AiNarrativeSectionKey; inlineValue: string | null } | null {
  const normalized = line.replace(/^\s*[-*]\s*/, '').trim()
  const match = normalized.match(
    /^(?:\*\*)?\s*(decision|why|commercial impact|what changed)\s*(?:\*\*)?\s*:?\s*(.*)$/i,
  )
  if (!match) return null

  const heading = match[1].toLowerCase()
  const inline = match[2]?.trim() || null
  const key =
    heading === 'commercial impact'
      ? 'commercialImpact'
      : heading === 'what changed'
        ? 'whatChanged'
        : (heading as 'decision' | 'why')

  return { key, inlineValue: inline }
}

function normalizeNarrativeText(lines: string[]) {
  const joined = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  return joined.length > 0 ? joined : null
}
