import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { QuoteDraftLinesTable } from '@/components/quotes/quote-draft-lines-table'
import { QuoteDraftSummary } from '@/components/quotes/quote-draft-summary'
import { QuoteDraftChangeStrip } from '@/components/quotes/quote-draft-change-strip'
import { ReviewActions } from '@/components/renewal-cases/review-actions'
import { WorkflowJourney } from '@/components/layout/workflow-journey'
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
  const reviewComplete =
    quoteDraft.statusLabel.toLowerCase() === 'approved' ||
    quoteDraft.statusLabel.toLowerCase() === 'rejected'
  const quotePurpose = 'Review the editable baseline quote before scenario quote comparison.'
  const quoteNextStep = reviewComplete
    ? 'Decision is complete. Use this page for audit review or continue to Scenario Quote Review.'
    : 'Review the change strip and line deltas, then continue to Scenario Quote Review.'

  return (
    <div className="page">
      <section className="card quote-review-hero">
        <div className="quote-review-main">
          <div>
            <h1 className="quote-review-title">Baseline Quote Review</h1>
            <p className="quote-review-subtitle">
              Understand what changed from the baseline renewal, why lines were added or modified,
              and verify commercial impact before approval.
            </p>
            <div className="page-header-guidance" style={{ marginTop: 10 }}>
              <p className="page-header-purpose">
                <strong>Purpose:</strong> {quotePurpose}
              </p>
              <p className="page-header-next">
                <strong>Next:</strong> {quoteNextStep}
              </p>
            </div>
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
              Baseline Quote Actions
            </div>

            <div className="quote-review-action-row">
              <Link className="button-tertiary" href={`/renewal-cases/${quoteDraft.renewalCase.id}`}>
                Open Generation Trace
              </Link>
              <Link className="button-tertiary" href={`/scenario-quotes/${quoteDraft.renewalCase.id}`}>
                Open Scenario Quote Review
              </Link>
            </div>

            <ReviewActions quoteDraftId={quoteDraft.id} align="left" />

            <div className="small muted">
              Baseline lines: {baselineLineCount} · Updated/AI lines: {changedLineCount}
            </div>
          </div>
        </div>
      </section>

      <WorkflowJourney
        title="Business Review Flow"
        subtitle="Review subscription scope, baseline quote, and scenario quote before using optional generation trace."
        steps={[
          {
            id: 'subscriptions',
            label: 'Review Renewal Subscriptions',
            description: 'Baseline subscription context reviewed.',
            href: '/renewal-cases?view=list',
            state: 'complete',
          },
          {
            id: 'baseline-quote',
            label: 'Review Baseline Quote',
            description: reviewComplete
              ? 'Baseline quote decision is complete.'
              : 'Validate line-level changes and commercial impact.',
            href: `/quote-drafts/${quoteDraft.id}`,
            state: reviewComplete ? 'complete' : 'current',
          },
          {
            id: 'scenario-workspace',
            label: 'Review Scenario Quote',
            description: 'Scenario alternatives are available for comparison against baseline.',
            href: `/scenario-quotes/${quoteDraft.renewalCase.id}`,
            state: 'upcoming',
          },
          {
            id: 'decision-workspace',
            label: 'Scenario Quote Generation Trace',
            description: 'Optional explanation console for how scenario quote evidence was generated.',
            href: `/renewal-cases/${quoteDraft.renewalCase.id}`,
            state: 'upcoming',
          },
        ]}
      />

      <QuoteDraftSummary summary={quoteDraft.summary} />
      <QuoteDraftChangeStrip summary={quoteDraft.changeSummary} />

      <QuoteDraftLinesTable lines={quoteDraft.lines} />
    </div>
  )
}
