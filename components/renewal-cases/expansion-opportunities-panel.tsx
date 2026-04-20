import { formatCurrency } from '@/lib/format/currency'
import { AddOpportunityToQuoteButton } from '@/components/renewal-cases/add-opportunity-to-quote-button'
import { Badge } from '@/components/ui/badge'

type ExpansionOpportunityView = {
  id: string
  title: string
  opportunityTypeLabel: string
  statusLabel: string
  statusTone?: 'default' | 'info' | 'success' | 'warn' | 'danger'
  isAddedToQuote?: boolean
  productName: string
  productSku: string
  productFamily: string
  reasonSummary: string
  expectedValueSummary: string | null
  confidenceScore: number | null
  fitScore: number | null
  recommendedQuantity: number | null
  recommendedUnitPriceFormatted: string | null
  recommendedDiscountPercentFormatted: string | null
  estimatedArrImpactFormatted: string | null
}

export function ExpansionOpportunitiesPanel({
  caseId,
  items,
  currencyCode,
}: {
  caseId: string
  items: ExpansionOpportunityView[]
  currencyCode: string
}) {
  return (
    <div className="card">
      <div className="section-header" style={{ marginBottom: 16 }}>
        <div>
          <h3 className="panel-title">AI Expansion Opportunities</h3>
          <p className="section-subtitle">
            Structured expansion and cross-sell suggestions identified for this renewal case.
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty-note">
          No expansion opportunities are currently suggested for this case.
        </div>
      ) : (
        <div className="opportunity-list">
          {items.map((item) => (
            <div key={item.id} className="opportunity-card">
              <div className="opportunity-top-row">
                <div>
                  <div className="opportunity-title-row">
                    <div className="opportunity-title">{item.title}</div>
                    <span className="scenario-chip">{item.opportunityTypeLabel}</span>
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
                </div>
              </div>

              <p className="opportunity-reason">{item.reasonSummary}</p>

              {item.expectedValueSummary ? (
                <p className="opportunity-expected-value">{item.expectedValueSummary}</p>
              ) : null}

              <div className="opportunity-metrics-grid">
                <Metric
                  label="Confidence"
                  value={item.confidenceScore != null ? `${item.confidenceScore}` : '—'}
                />
                <Metric
                  label="Fit Score"
                  value={item.fitScore != null ? `${item.fitScore}` : '—'}
                />
                <Metric
                  label="Suggested Qty"
                  value={item.recommendedQuantity != null ? `${item.recommendedQuantity}` : '—'}
                />
                <Metric label="Unit Price" value={item.recommendedUnitPriceFormatted ?? '—'} />
                <Metric
                  label="Discount"
                  value={item.recommendedDiscountPercentFormatted ?? '—'}
                />
                <Metric
                  label="ARR Impact"
                  value={
                    item.estimatedArrImpactFormatted ??
                    formatCurrency(0, currencyCode).replace(/0(?:\.00)?$/, '—')
                  }
                />
              </div>

              <div className="opportunity-actions">
                {item.isAddedToQuote ? (
                  <button type="button" className="button-success" disabled>
                    Added to Quote
                  </button>
                ) : (
                  <AddOpportunityToQuoteButton
                    caseId={caseId}
                    opportunityId={item.id}
                  />
                )}

                <button type="button" className="button-secondary" disabled>
                  Dismiss
                </button>
              </div>
            </div>
          ))}
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