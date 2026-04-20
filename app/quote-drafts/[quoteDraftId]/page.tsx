import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { QuoteDraftLinesTable } from '@/components/quotes/quote-draft-lines-table'
import { QuoteDraftSummary } from '@/components/quotes/quote-draft-summary'
import { ReviewActions } from '@/components/renewal-cases/review-actions'
import { getQuoteDraftById } from '@/lib/db/quote-drafts'

function isAiAddedLine(sourceType: string | null) {
  return sourceType === 'AI_SUGGESTED'
}

function isBaselineRenewalLine(sourceType: string | null, sourceQuoteInsightId: string | null) {
  return sourceType === 'RENEWAL' && !sourceQuoteInsightId
}

export default async function QuoteDraftDetailPage({
  params,
}: {
  params: Promise<{ quoteDraftId: string }>
}) {
  const { quoteDraftId } = await params
  const quoteDraft = await getQuoteDraftById(quoteDraftId)

  if (!quoteDraft) {
    notFound()
  }

  const baselineLineCount = quoteDraft.lines.filter((line) =>
    isBaselineRenewalLine(line.traceability.sourceType, line.traceability.sourceQuoteInsightId),
  ).length
  const aiAddedLineCount = quoteDraft.lines.filter((line) =>
    isAiAddedLine(line.traceability.sourceType),
  ).length
  const changedLineCount = quoteDraft.lines.length - baselineLineCount

  return (
    <div className="page">
      <section className="card quote-review-hero">
        <div className="quote-review-main">
          <div>
            <h1 className="quote-review-title">Renewal Quote Draft Review</h1>
            <p className="quote-review-subtitle">
              Understand what changed from the baseline renewal, why lines were added or modified,
              and verify commercial impact before approval.
            </p>
          </div>

          <div className="quote-review-context-grid">
            <div className="quote-review-context-item">
              <div className="small muted">Quote</div>
              <div className="quote-review-context-value">{quoteDraft.quoteNumber}</div>
            </div>
            <div className="quote-review-context-item">
              <div className="small muted">Account</div>
              <div className="quote-review-context-value">{quoteDraft.renewalCase.accountName}</div>
            </div>
            <div className="quote-review-context-item">
              <div className="small muted">Renewal Case</div>
              <div className="quote-review-context-value">{quoteDraft.renewalCase.caseNumber}</div>
            </div>
          </div>
        </div>

        <div className="quote-review-right">
          <div className="quote-review-badges">
            <Badge tone={quoteDraft.statusTone}>{quoteDraft.statusLabel}</Badge>
            <Badge tone={aiAddedLineCount > 0 ? 'info' : 'default'}>
              AI Added {aiAddedLineCount}
            </Badge>
            <Badge tone={changedLineCount > 0 ? 'warn' : 'default'}>
              Changed Lines {changedLineCount}
            </Badge>
          </div>

          <div className="quote-review-actions">
            <div className="small muted" style={{ fontWeight: 700 }}>
              Quote Review Actions
            </div>

            <div className="quote-review-action-row">
              <Link className="button-secondary" href={`/renewal-cases/${quoteDraft.renewalCase.id}`}>
                Back to Renewal Workflow
              </Link>
            </div>

            <ReviewActions quoteDraftId={quoteDraft.id} align="left" />

            <div className="small muted">
              Baseline lines: {baselineLineCount} · Updated/AI lines: {changedLineCount}
            </div>
          </div>
        </div>
      </section>

      <QuoteDraftSummary summary={quoteDraft.summary} />

      <QuoteDraftLinesTable lines={quoteDraft.lines} />
    </div>
  )
}
